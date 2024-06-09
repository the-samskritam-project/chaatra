package parser

import "testing"

func TestApteParseEntry(t *testing.T) {
	content := `<s>hve</s>  1 <ab>U.</ab> (<s>hvayati-te, juhAva, juhuve</s>, <s>ahvat-ta, ahvAsta, hvAsyati-te, hvAtuM, hUta</s>; <i><ab>pass.</ab></i> <s>hUyate</s>; <i><ab>caus.</ab></i> <s>hvAyayati-te</s>; <i><ab>desid.</ab></i> <s>juhUzati-te</s>) <div n="1"/><b>1</b> To call by name; <s>tAM</s> <lbinfo n="pArvatItyA#Bijanena"/> <s>pArvatItyABijanena nAmnA baMDupriyAM baMDujano juhAva</s> <ls>Ku. 1. 26.</ls> <div n="1"/><b>2</b> To call out, invoke, call upon. <div n="1"/><b>3</b> To call, name. <div n="1"/><b>4</b> To challenge. <div n="1"/><b>5</b> To vie with, emulate. <div n="1"/><b>6</b> To ask, beg.`

	parser := NewParser()

	parser.ParseEntry(content)
}
