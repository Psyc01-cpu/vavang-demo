/* Double authentification par code à usage unique (TOTP, RFC 6238), compatible avec les applications
   d'authentification courantes (Google Authenticator, Microsoft Authenticator, FreeOTP, Aegis…).
   Calcul local avec l'API cryptographique du navigateur : aucun service extérieur. */
(function () {
  'use strict';
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  function base32(octets) {
    let bits = 0, valeur = 0, sortie = '';
    for (const o of octets) { valeur = (valeur << 8) | o; bits += 8; while (bits >= 5) { sortie += ALPHABET[(valeur >>> (bits - 5)) & 31]; bits -= 5; } }
    if (bits > 0) sortie += ALPHABET[(valeur << (5 - bits)) & 31];
    return sortie;
  }
  function deBase32(texte) {
    const t = String(texte).toUpperCase().replace(/[^A-Z2-7]/g, ''); let bits = 0, valeur = 0; const out = [];
    for (const ch of t) { valeur = (valeur << 5) | ALPHABET.indexOf(ch); bits += 5; if (bits >= 8) { out.push((valeur >>> (bits - 8)) & 255); bits -= 8; } }
    return new Uint8Array(out);
  }
  async function code(secret, instant, pas, chiffres) {
    pas = pas || 30; chiffres = chiffres || 6;
    const compteur = Math.floor((instant == null ? Date.now() : instant) / 1000 / pas);
    const msg = new Uint8Array(8); let c = compteur; for (let i = 7; i >= 0; i--) { msg[i] = c & 255; c = Math.floor(c / 256); }
    const cle = await crypto.subtle.importKey('raw', deBase32(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const h = new Uint8Array(await crypto.subtle.sign('HMAC', cle, msg));
    const o = h[h.length - 1] & 15;
    const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
    return String(n % Math.pow(10, chiffres)).padStart(chiffres, '0');
  }
  window.TOTP = {
    genererSecret: () => base32(crypto.getRandomValues(new Uint8Array(20))),
    code,
    // tolère un décalage d'horloge d'une période (30 s) de part et d'autre
    verifier: async (secret, saisi, fenetre) => {
      const s = String(saisi || '').replace(/\s/g, ''); if (!/^\d{6}$/.test(s)) return false;
      const f = fenetre == null ? 1 : fenetre;
      for (let k = -f; k <= f; k++) if (await code(secret, Date.now() + k * 30000) === s) return true;
      return false;
    },
    uri: (secret, compte, emetteur) => 'otpauth://totp/' + encodeURIComponent(emetteur + ':' + compte) + '?secret=' + secret + '&issuer=' + encodeURIComponent(emetteur) + '&algorithm=SHA1&digits=6&period=30'
  };
})();
