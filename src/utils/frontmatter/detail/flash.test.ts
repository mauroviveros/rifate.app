import { describe, expect, it } from 'vitest';

import { flashMessage } from './flash';

describe('flashMessage', () => {
  it('sin flag no hay cartel', () => {
    expect(flashMessage(null)).toBeNull();
    expect(flashMessage('')).toBeNull();
  });

  /** El `?ok=` lo escribe cualquiera en la barra: lo que no conocemos se ignora. */
  it('un flag desconocido se ignora', () => {
    expect(flashMessage('exploded-9')).toBeNull();
  });

  it('publicada y editada no llevan cuenta', () => {
    expect(flashMessage('published')).toBe('Listo: tu rifa quedó publicada.');
    expect(flashMessage('updated')).toBe('Listo: guardamos los cambios.');
  });

  it('vender: singular y plural', () => {
    expect(flashMessage('sold-1')).toBe('Vendiste 1 número.');
    expect(flashMessage('sold-3')).toBe('Vendiste 3 números.');
  });

  it('liberar: singular y plural', () => {
    expect(flashMessage('freed-1')).toBe('Liberaste 1 número.');
    expect(flashMessage('freed-2')).toBe('Liberaste 2 números.');
  });
});
