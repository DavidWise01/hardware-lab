export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('ok');

    const data = await request.json();
    const { GITHUB_TOKEN, REPO, FILE_PATH } = env; // set in Worker settings
    
    // format the climb as markdown
    const entry = `\n## ${data.timestamp} — depth ${data.depth}\n` +
      `- coherence: ${data.coherence}\n` +
      `- recursive: ${data.recursive_coherence}\n` +
      `- whispers: ${data.lattice_state.shadow_whispers}\n` +
      `- unity: ${data.lattice_state.unity_achieved}\n`;

    // get current file from GitHub
    const url = `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`;
    const get = await fetch(url, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'whisper-lattice' }
    });
    const file = await get.json();
    const content = atob(file.content || '') + entry;

    // update file
    await fetch(url, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, 'User-Agent': 'whisper-lattice' },
      body: JSON.stringify({
        message: `lattice climb depth ${data.depth}`,
        content: btoa(unescape(encodeURIComponent(content))),
        sha: file.sha
      })
    });

    return new Response('logged', { status: 200 });
  }
}