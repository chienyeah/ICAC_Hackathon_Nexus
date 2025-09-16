function mustAddr(name: string): `0x${string}` {
  // Vite injects envs at build time
  const v = (import.meta as any).env[name] as string | undefined;
  if (!v || !/^0x[0-9a-fA-F]{40}$/.test(v)) {
    alert(`Missing/invalid ${name} in web/.env`);
    throw new Error(`Missing/invalid ${name}. Got: ${JSON.stringify(v)}`);
  }
  return v as `0x${string}`;
}

export const ADDR = {
  ROLES: mustAddr("VITE_ROLES"),
  TOKEN: mustAddr("VITE_TOKEN"),
  TRANSFER: mustAddr("VITE_TRANSFER"),
  PRIZE: mustAddr("VITE_PRIZE"),
  SPONSOR: mustAddr("VITE_SPONSOR"),
  DISCIPLINARY: mustAddr("VITE_DISCIPLINARY"),
};
