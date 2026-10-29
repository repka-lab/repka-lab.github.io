// Publishing to X through the official API (twitter-api-v2, OAuth 1.0a).
// Stub: until the publishing task is done, every call refuses and nothing is sent.
//
// Guards the implementation must keep:
// - nothing goes out without the owner's explicit "publish";
// - the post's prediction is already in data/ledger.json;
// - forbidden words are rejected (the disclaimer itself is exempt: it contains "buying");
// - the disclaimer is present verbatim.

export async function publish(): Promise<never> {
  throw new Error('Publishing is not implemented yet. Nothing was sent.');
}
