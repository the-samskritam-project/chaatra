
export function find(str, subStr) {
    const givenStr = [...str];
    const givenSubStr = [...subStr];

    var subStrIndex = 0;
    var foundAt = [];

    for (var i = 0; i < givenStr.length; i++) {
        if (subStrIndex == givenSubStr.length) {
            foundAt.push(i - givenSubStr.length);
            subStrIndex = 0;
            continue;
        }

        if (subStrIndex < givenSubStr.length 
            && givenStr[i] == givenSubStr[subStrIndex]) {
            subStrIndex++;
            continue;
        }

        subStrIndex = 0;
    }

    if (subStrIndex == givenSubStr.length) {
        foundAt.push(i - givenSubStr.length);
    }

    return foundAt;
}