def extract_bundle(source, destination):
    """Keep package .bin symlinks, but never extract outside the private staging directory."""
    root = os.path.realpath(destination)

    def inside(path):
        return os.path.commonpath((root, os.path.realpath(path))) == root

    with tarfile.open(source, "r:*") as archive:
        members = archive.getmembers()
        for member in members:
            path = os.path.join(root, member.name)
            if os.path.isabs(member.name) or not inside(path):
                raise ValueError("bundle member escapes its directory: " + member.name)
            if not (member.isdir() or member.isfile() or member.issym() or member.islnk()):
                raise ValueError("unsupported bundle member: " + member.name)
            if not member.isdir() and os.path.normpath(path) == root:
                raise ValueError("bundle member overwrites its directory")
            if member.issym() or member.islnk():
                base = os.path.dirname(path) if member.issym() else root
                if os.path.isabs(member.linkname) or not inside(os.path.join(base, member.linkname)):
                    raise ValueError("bundle link escapes its directory: " + member.name)
        # Links have all been checked against a new, private directory. Recheck resolved
        # paths as links appear so an archive cannot redirect a later file outside it.
        symlinks = []
        for member in members:
            if not inside(os.path.join(root, member.name)):
                raise ValueError("bundle member escapes through a link: " + member.name)
            if member.issym() or member.islnk():
                base = os.path.dirname(os.path.join(root, member.name)) if member.issym() else root
                if not inside(os.path.join(base, member.linkname)):
                    raise ValueError("bundle link escapes through another link: " + member.name)
            if member.isdir():
                os.makedirs(os.path.join(root, member.name), exist_ok=True)
            else:
                archive.extract(member, root, set_attrs=False)
                if member.issym():
                    symlinks.append(os.path.join(root, member.name))
                    if any(not inside(path) for path in symlinks):
                        raise ValueError("bundle contains a link chain outside its directory")
                if member.isfile() and not member.issym():
                    os.chmod(os.path.join(root, member.name), 0o555 if member.mode & 0o111 else 0o444)


