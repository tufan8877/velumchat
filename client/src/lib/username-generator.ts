const adjectives = [
  'ghost', 'shadow', 'crypto', 'whisper', 'silent', 'hidden', 'secret', 'phantom',
  'dark', 'stealth', 'invisible', 'masked', 'covert', 'mystic', 'cipher', 'void',
  'quantum', 'digital', 'neon', 'flux', 'enigma', 'rogue', 'apex', 'nova',
  'frost', 'storm', 'ember', 'echo', 'pulse', 'shift', 'drift', 'surge'
];

const animals = [
  'whale', 'fox', 'ninja', 'owl', 'wolf', 'raven', 'spider', 'tiger',
  'dragon', 'phoenix', 'viper', 'hawk', 'panther', 'lynx', 'falcon', 'shark',
  'octopus', 'scorpion', 'jaguar', 'cobra', 'eagle', 'mantis', 'leopard', 'bat',
  'kraken', 'griffon', 'sphinx', 'chimera', 'hydra', 'wraith', 'banshee', 'spectre'
];

export function generateUsername(): string {
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const number = Math.floor(Math.random() * 999) + 100;
  
  return `${adjective}_${animal}_${number}`;
}

export function validateUsername(username: string): { isValid: boolean; error?: string } {
  if (!username.trim()) {
    return { isValid: false, error: "Username cannot be empty" };
  }
  
  if (username.length < 3) {
    return { isValid: false, error: "Username must be at least 3 characters long" };
  }
  
  if (username.length > 30) {
    return { isValid: false, error: "Username must be less than 30 characters long" };
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { isValid: false, error: "Username can only contain letters, numbers, and underscores" };
  }
  
  return { isValid: true };
}
