export const splitShlokaLines = (text) => {
  if (!text) {
    return [];
  }

  let normalized = text;

  // Remove numbered endings like "।।6.121.2।।" completely (don't replace with ||)
  normalized = normalized.replace(/।।\d+(?:\.\d+)*।।/g, '');
  normalized = normalized.replace(/।।\d+(?:\.\d+)*$/g, '');

  // Convert remaining danda punctuation into bars
  // First handle double danda (||) - this marks the end of second line
  normalized = normalized.replace(/।।/g, ' || ');
  // Then handle single danda (|) - this marks the end of first line
  normalized = normalized.replace(/।/g, ' | ');

  // Collapse whitespace for cleaner parsing
  normalized = normalized.replace(/\s+/g, ' ').trim();

  const lines = [];
  const regex = /(.*?)(\|\||\||$)/g;
  let match;

  while ((match = regex.exec(normalized)) !== null) {
    const content = match[1].trim();
    const delimiter = match[2];

    if (!content && delimiter) {
      continue;
    }

    // Include the delimiter in the line (| for first line, || for second line)
    const line = delimiter ? `${content} ${delimiter}`.trim() : content;
    if (line) {
      lines.push(line);
    }

    if (!delimiter) {
      break;
    }
  }

  return lines;
};

export const splitTranslationTokens = (translation) => {
  if (!translation) {
    return [];
  }

  return translation
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);
};

