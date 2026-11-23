def _local_host(host):
    host = host.casefold().rstrip(".")
    names = {socket.gethostname(), socket.getfqdn(), os.uname().nodename}
    return bool(host) and host in {
        alias.casefold().rstrip(".")
        for name in names for alias in (name, name.split(".")[0], name[:39])
    }


