def initialize_error(ctx, message, context=None):
    ctx.context = context
    ValueError.__init__(ctx, message + ("\n" + str(context) if context is not None else ""))
