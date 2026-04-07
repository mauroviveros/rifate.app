export const getNumberLength = (number: number) => {
  return String(number - 1).length;
}

export const getUniqueRandomNumbers = (max: number, count = 1, existing: number[] = []) => {
  const result = [];
  const used = new Set(existing);

  if (used.size > max) return existing;

  while (result.length < count) {
    const random = Math.floor(Math.random() * max);

    if (!used.has(random)) {
      used.add(random);
      result.push(random);
    }

    if (used.size === max) break;
  }

  return result;
}
