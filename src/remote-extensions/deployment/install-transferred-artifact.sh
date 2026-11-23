set -eu
source=$1
destination=$2
expected=$3
compressed=$4
executable=$5
temporary=$source.install
trap 'rm -f -- "$temporary" "$source"' EXIT

if [ "$compressed" = gzip ]; then
    # Open only the owner's existing inode. Abort may unlink it before exec starts.
    exec 3< "$temporary"
    gzip -dc < "$source" > /proc/self/fd/3
    installed=$temporary
else
    installed=$source
fi
actual=$(sha256sum < "$installed")
if [ "${actual%% *}" != "$expected" ]; then
    printf '%s\n' 'environment artifact decompressed SHA-256 mismatch' >&2
    exit 1
fi
if [ "$executable" = yes ]; then
    chmod 555 -- "$installed"
else
    chmod 444 -- "$installed"
fi
mv -f -- "$installed" "$destination"
