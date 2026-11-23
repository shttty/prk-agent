import { spawn } from "node:child_process";

const python = String.raw`
import errno, json, os, pty, select, signal, sys, time
request = json.load(sys.stdin)
pid, fd = pty.fork()
if pid == 0:
    os.execvpe(request["argv"][0], request["argv"], request["env"])
def prompt():
    output = bytearray()
    deadline = time.monotonic() + 10
    while b'\x1b]133;B\x07' not in output:
        remaining = deadline - time.monotonic()
        if remaining <= 0 or not select.select([fd], [], [], remaining)[0]:
            raise RuntimeError("No shell prompt marker: " + repr(bytes(output)))
        try:
            chunk = os.read(fd, 65536)
        except OSError as error:
            if error.errno != errno.EIO:
                raise
            chunk = b''
        if not chunk:
            raise RuntimeError("Shell exited before prompt: " + repr(bytes(output)))
        output.extend(chunk)
    return output.decode()
try:
    output = [prompt()]
    for command in request["commands"]:
        os.write(fd, command.encode() + b'\n')
        output.append(prompt())
    if request["hardKill"]:
        os.kill(pid, signal.SIGKILL)
    else:
        os.write(fd, b'exit\n')
    deadline = time.monotonic() + 10
    while os.waitpid(pid, os.WNOHANG)[0] == 0:
        if time.monotonic() >= deadline:
            raise RuntimeError("Shell did not exit")
        if select.select([fd], [], [], 0.02)[0]:
            try:
                os.read(fd, 65536)
            except OSError as error:
                if error.errno != errno.EIO:
                    raise
    pid = 0
    print(json.dumps(output))
finally:
    os.close(fd)
    if pid:
        os.kill(pid, signal.SIGKILL)
        os.waitpid(pid, 0)
`;

export async function runBashPty(home, argv, commands, { hardKill = false } = {}) {
  const env = { ...process.env, HOME: home, TERM: "xterm-256color" };
  for (const key of ["DEBIAN_FRONTEND", "PIP_NO_INPUT", "PYTHONUNBUFFERED", "GIT_TERMINAL_PROMPT", "HISTFILE", "PROMPT_COMMAND"]) delete env[key];
  const child = spawn(process.env.PI_TEST_PYTHON ?? "python3", ["-c", python], { cwd: home, stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const done = Promise.withResolvers();
  child.once("error", done.reject);
  child.once("close", (code) => code === 0 ? done.resolve() : done.reject(new Error(`PTY failed (${code}): ${stderr}`)));
  child.stdin.end(JSON.stringify({ argv, env, commands, hardKill }));
  await done.promise;
  return JSON.parse(stdout).map((output) => output.replaceAll("\r", ""));
}
