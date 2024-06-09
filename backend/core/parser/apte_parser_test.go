package parser

import (
	"testing"
)

func TestApteParseEntry(t *testing.T) {
	testEntries := []string{
		`<s>Kid</s>  <br/> <span style="font-size:larger;font-weight:bold;">I.</span> 6 <ab>P.</ab> (<s>KiMdati, Kinna</s>) To strike, press down, afflict. <br/> <span style="font-size:larger;font-weight:bold;">II.</span> 4 7 <ab>A.</ab> (<s>Kidyate, KiMtte, Kinna</s>)  To suffer pain or misery, to be afflicted or wearied, feel tired, depressed or exhausted;  <lbinfo n="ls:Ś.+ 5. 7"/> <ls>Ś. 5. 7</ls>; <s>sa puruzo yaH Kidyate neMdriyEH</s> <ls>H. 2. 141</ls> overpowered; <s>kiM nAma mayi Kidyate garu</s> <ls>Ve. 1</ls>; <ls>Śānti. 3. 7</ls>; <ls>Bk. 14. 108</ls>,  <lbinfo n="ls:17.+10"/> <ls n="Bk.">17. 10.</ls> <div n="1"/><i>— <ab>Caus.</ab></i> <div n="1"/><b>1</b> To frighten, terrify. <div n="1"/><b>2</b> To exhaust, fatigue, make tired.`,
		`<s>hve</s>  1 <ab>U.</ab> (<s>hvayati-te, juhAva, juhuve</s>, <s>ahvat-ta, ahvAsta, hvAsyati-te, hvAtuM, hUta</s>; <i><ab>pass.</ab></i> <s>hUyate</s>; <i><ab>caus.</ab></i> <s>hvAyayati-te</s>; <i><ab>desid.</ab></i> <s>juhUzati-te</s>) <div n="1"/><b>1</b> To call by name; <s>tAM</s> <lbinfo n="pArvatItyA#Bijanena"/> <s>pArvatItyABijanena nAmnA baMDupriyAM baMDujano juhAva</s> <ls>Ku. 1. 26.</ls> <div n="1"/><b>2</b> To call out, invoke, call upon. <div n="1"/><b>3</b> To call, name. <div n="1"/><b>4</b> To challenge. <div n="1"/><b>5</b> To vie with, emulate. <div n="1"/><b>6</b> To ask, beg.`,
		`<s>gaD</s>  4 <ab>P.</ab> (<s>gaDyati</s>) To be mixed.`,
		`<s>gopin, -gopila</s>  <i><ab>a.</ab></i> Protecting, <lbinfo n="pre+serving"/> preserving.`,
		`<s>grAmya</s>  <i><ab>a.</ab></i> [<s>grAma-yat</s>] <div n="1"/><b>1</b> Relating to or used in a village; <ls>Ms. 6. 3</ls>;  <lbinfo n="ls:7.+120"/> <ls n="Ms.">7. 120.</ls> <div n="1"/><b>2</b> Living in a village, rural, rustic; <s>alpavyayena suMdari grAmyajano</s> <lbinfo n="mi#zwamaSnAti"/> <s>mizwamaSnAti</s> <ls>Chand. M. 1.</ls> <div n="1"/><b>3</b> <lbinfo n="Domestic+ated"/> Domesticated, tame (as an animal). <div n="1"/><b>4</b> <lbinfo n="Cul+tivated"/> Cultivated (<ab>opp.</ab> <s>vanya</s> ‘growing wild’). <div n="1"/><b>5</b> Low, vulgar, used only by low people (as a word); <s>cuMbanaM dehi me BArye</s> <s>kAmacAMqAlatfptaye</s> <ls>R. G.</ls>, or <s>kawiste harate</s> <s>manaH</s> <ls>S. D. 574</ls>, are instances of <s>grAmya</s> expressions. <div n="1"/><b>6</b> Indecent, obscene. <div n="1"/><b>7</b> Relating to sexual pleasures. <div n="1"/><b>8</b> Relating to a musical scale. <div n="1"/><b>—</b> <s>myaH</s> <div n="1"/><b>1</b> A tame hog. <div n="1"/><b>2</b> The first two signs of the zodiac, <i>Aries</i> and <i>Taurus</i>. <div n="1"/><b>—</b> <s>myA</s> The Indigo plant. <div n="1"/><b>—</b> <s>myaM</s> <div n="1"/><b>1</b> A rustic speech. <div n="1"/><b>2</b> Food <lbinfo n="pre+pared"/> prepared in a village. <div n="1"/><b>3</b> Sexual <lbinfo n="inter+course"/> intercourse. <div n="1"/><b>4</b> Acceptance. <div n="1"/><b>Comp.</b> <div n="1"/><b>—</b> <s>aSvaH</s> an ass. <div n="1"/><b>—</b> <s>karman</s> <i><ab>n.</ab></i> <div n="1"/> 1 the <lbinfo n="occupa+tion"/> occupation of a villager. <div n="1"/> 2 sexual plea sure. <div n="1"/><b>—</b> <s>kuMkumaM</s> safflower. <div n="1"/><b>—</b> <s>DarmaH</s> <div n="1"/> 1 the duty of a villager. <div n="1"/> 2 sexual <lbinfo n="inter+course"/> intercourse, copulation. <div n="1"/> 3 the right of a villager (as <ab>opp.</ab> to that of a ‘recluse’). <div n="1"/><b>—</b> <s>paSuH</s> a domestic animal. <div n="1"/><b>—</b> <s>budDi</s> <i><ab>a.</ab></i> boorish, clownish, ignorant. <div n="1"/><b>—</b> <s>mfgaH</s> a dog. <div n="1"/><b>—</b> <s>vallaBA</s> a harlot, prostitute. <div n="1"/><b>—</b> <s>suKaM</s> sexual intercourse, <lbinfo n="copula+tion"/> <br/>(<ab n="Page 0474-b">pb</ab>)  copulation.`,
	}

	parser := NewParser()

	for _, testEntry := range testEntries {
		_, err := parser.ParseEntry(testEntry)
		if err != nil {
			t.Fatalf("Expected no error for %s but got %s", testEntry, err.Error())
		}
	}
}

func TestApteParserFullXML(t *testing.T) {
	parser := NewParser()

	_, err := parser.ParseFullDictionary(`../test_dictionary.xml`)
	if err != nil {
		t.Fatalf("Expected no error, but got : %s", err.Error())
	}
}
