from prk_tool import config, host
from prk_tools.hashline import Session


def assemble_files(ctx):
    ctx._options = config(__package__)
    ctx._session = Session(execute=lambda name, args: host.file_call(name, **args), **ctx._options)
