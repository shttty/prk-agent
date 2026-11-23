import { randomUUID } from "node:crypto";
import { quoteShell } from "../../../src/target-environment/daemon/quote-shell.mjs";

/** Owned target wrapper only; the daemon, process SDK and runtime protocol remain real. */
export async function createOwnedRuntime(fixture, python, sequence, { gate = false, beforeExec = "" } = {}) {
  const prefix = `${fixture.root}/runtime-${sequence}`;
  const signature = randomUUID();
  const source = `import json,os,subprocess,sys,time
python=${JSON.stringify(python)}
prefix=${JSON.stringify(prefix)}
child=subprocess.Popen(['sleep','300'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
record={'signature':${JSON.stringify(signature)},'pid':os.getpid(),'pgid':os.getpgrp(),'child':child.pid,'runtimePid':os.getpid()}
${beforeExec}
if ${gate ? "True" : "False"}:
    runtime=subprocess.Popen([python,*sys.argv[1:]],stdin=sys.stdin.buffer,stdout=subprocess.PIPE,stderr=sys.stderr.buffer)
    record['runtimePid']=runtime.pid
with open(prefix+'.json','w') as output:
    json.dump(record,output)
if ${gate ? "True" : "False"}:
    for line in runtime.stdout:
        try:
            reply=json.loads(line)
        except (ValueError,UnicodeDecodeError):
            reply={}
        if 're' in reply and os.path.exists(prefix+'.hold'):
            with open(prefix+'.blocked','a') as output:
                output.write(str(reply['re'])+'\\n')
            while os.path.exists(prefix+'.hold'):
                time.sleep(0.01)
        sys.stdout.buffer.write(line)
        sys.stdout.buffer.flush()
    sys.exit(runtime.wait())
os.execv(python,[python,*sys.argv[1:]])
`;
  const executable = `${prefix}.sh`;
  const script = `#!/bin/sh\nexec ${quoteShell(python)} -u -c ${quoteShell(source)} "$@"\n`;
  await fixture.observe(`printf %s ${quoteShell(script)} > ${quoteShell(executable)}\nchmod +x ${quoteShell(executable)}\n`);
  return { executable, prefix, signature };
}
