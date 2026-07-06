// The services read window.location at import time; stub the minimum the
// code touches instead of pulling in a full DOM environment.
globalThis.window = {
  location: { protocol: "http:", hostname: "localhost" },
};
