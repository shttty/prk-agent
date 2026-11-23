def disk_of(path):
    try:
        st = os.statvfs(path)
        return {"total": st.f_frsize * st.f_blocks, "free": st.f_frsize * st.f_bavail}
    except OSError:
        return None
