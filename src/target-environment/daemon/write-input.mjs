export function writeInput(stream, bytes) {
  const { promise, resolve, reject } = Promise.withResolvers();
  stream.write(bytes, (error) => error ? reject(error) : resolve());
  return promise;
}
