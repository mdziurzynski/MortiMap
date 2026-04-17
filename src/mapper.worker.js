import { alignAll } from './nwaligner.js';

self.onmessage = function (e) {
  const { queries, references } = e.data;
  
  if (!queries || !references) {
    self.postMessage({ error: "Missing sequences or references" });
    return;
  }

  try {
    const results = alignAll(queries, references, {
      match: 2,
      mismatch: -4,
      gapOpen: 20,
      gapExt: 2,
    });

    self.postMessage({ alignments: results });
  } catch (err) {
    self.postMessage({ error: err.message });
  }
};
