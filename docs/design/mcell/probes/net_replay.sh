#!/bin/bash
# Replay: bash net_replay.sh /path/to/python /path/to/prior/py [ladder|async]
# Save stdout as JSONL and stderr as the namespace/cleanup log. Repeat with 3.9.
set -euo pipefail
here=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
if [[ ${1:-} != --inside ]]; then
  python=$(realpath -s -- "${1:?usage: bash net_replay.sh PYTHON SCENARIO_DIR [ladder|async]}")
  [[ -x $python ]]
  version=$("$python" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
  [[ $version == 3.9 || $version == 3.12 ]]
  prior=$(realpath -- "${2:?SCENARIO_DIR must contain the original network scenario modules}")
  [[ -f $prior/a_net_endpoints.py && -f $prior/a_net_scenarios.py ]]
  mode=${3:-ladder}
  [[ $mode == ladder || $mode == async ]]
  unit="prk-net-r2-${version//./-}-$BASHPID-$RANDOM.scope"
  rc=0
  systemd-run --user --scope --quiet --unit="$unit" -p MemoryMax=512M \
    taskset -c 0 unshare -rn /bin/bash "$here/net_replay.sh" --inside \
    "$python" "$prior" "$mode" "$(readlink /proc/self/ns/net)" || rc=$?
  printf 'scope=%s returncode=%d\n' "$unit" "$rc" >&2
  systemctl --user show "$unit" -p LoadState -p ActiveState -p ControlGroup >&2
  [[ $(systemctl --user show "$unit" -p ActiveState --value) == inactive ]]
  exit "$rc"
fi
shift
python=$1 prior=$2 mode=$3 outer_net=$4
[[ $(readlink /proc/self/ns/net) != "$outer_net" ]]
# Same blackhole address/rule as prior a_net_scope.sh; no mount or DNS fixture.
ip link set lo up
ip addr add 10.255.255.1/32 dev lo
nft add table inet net_r2
nft 'add chain inet net_r2 output { type filter hook output priority 0; policy accept; }'
nft add rule inet net_r2 output ip daddr 10.255.255.1 tcp dport 22 counter drop
# Never consult an inherited proxy, PG service file, or session config.
while IFS= read -r key; do
  case ${key,,} in *_proxy|pg*) unset "$key";; esac
done < <(compgen -e)
cg=$(cut -d: -f3 /proc/self/cgroup)
mem=$(cat "/sys/fs/cgroup$cg/memory.max")
[[ $mem == 536870912 ]]
{
  printf 'scope=%s memory.max=%s netns=%s host_netns=%s\n' "$cg" "$mem" "$(readlink /proc/self/ns/net)" "$outer_net"
  grep '^Cpus_allowed_list:' /proc/self/status
  cat /proc/sys/kernel/yama/ptrace_scope
  uname -srmo
  ip -brief addr
  nft list ruleset
} >&2
for case in recv connect http tls_ssl tls_requests paramiko paramiko_banner pg_blackhole pg_prehandshake pg_query; do
  timeout -k 1s 8s "$python" -BI "$here/net_probe.py" "$prior" "$mode" "$case"
  case "$case" in
    connect|paramiko|pg_blackhole) printf 'after %s: ' "$case" >&2; nft list chain inet net_r2 output | grep 'counter packets' >&2;;
  esac
done
