import { vowels, consonants, vowelSigns, virama } from "./constants";

export function toDevanagiriString(latinStr) {
    const chars = [...latinStr];
    var result = [];
    const l = chars.length;
    var i = 0;
  
    for (; ;) {
      if (i == l) {
        break;
      }
  
      var rune = chars[i]
  
      if (rune === ' ') {
        result.push(' ');
        i = i + 1;
        continue;
      }
  
      var found = vowels.find(x => x.key === rune);
      if (found) {
        result.push(found.devanagari);
        i = i + 1;
        continue;
      } else {
        found = consonants.find(x => x.key === rune);
        if (found) {
          if (i + 1 < l) {
            const next = chars[i + 1];
            var nextChar = vowels.find(x => x.key === next);
            if (nextChar) {
              result.push(found.devanagari);
  
              if (nextChar.devanagari != 'अ') {
                result.push(vowelSigns[nextChar.devanagari]);
              }
  
              i = i + 2;
              continue;
            }
  
            nextChar = consonants.find(x => x.key === next);
            if (nextChar) {
              result.push(found.devanagari);
              result.push(virama);
  
              i = i + 1;
              continue;
            }
          } else if (i == l - 1) {
            result.push(found.devanagari);
            result.push(virama);
          }
        }
      }
  
      i++;
    }
  
    const res = result.join('');
    return res;
  }