import io
import pickle


class _BoundedCellPickle(io.BytesIO):
    def __init__(self, limit):
        super().__init__()
        self.limit = limit

    def write(self, data):
        if len(data) > self.limit - self.tell():
            raise ValueError("Isolated cell pickle exceeds process message budget")
        return super().write(data)


def pickle_cell_values(value, limit):
    with _BoundedCellPickle(limit) as data:
        pickle.Pickler(data, protocol=pickle.HIGHEST_PROTOCOL).dump(value)
        return data.getvalue()


def unpickle_cell_values(data):
    # Only use for complete frames from the cell's private target-local data endpoint.
    with io.BytesIO(data) as stream:
        value = pickle.Unpickler(stream).load()
        if stream.read(1):
            raise ValueError("Unexpected trailing bytes in isolated cell pickle")
        return value
