import base64
import io
import sys


def render_figure(figure):
    image = io.BytesIO()
    figure.savefig(image, format="png")
    return image.getvalue()


def collect_figures(ctx):
    pyplot = sys.modules.get("matplotlib.pyplot")
    if pyplot:
        for number in pyplot.get_fignums():
            image = base64.b64encode(render_figure(pyplot.figure(number))).decode("ascii")
            display_value(ctx, {"image/png": image}, raw=True)
            pyplot.close(number)
