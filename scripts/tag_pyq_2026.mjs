#!/usr/bin/env node
/**
 * Tag every PYQ with a 2026 syllabus sub-topic and flag time-sensitive General Awareness questions.
 *
 *   node scripts/tag_pyq_2026.mjs            # writes public/pyq/tags.json
 *   node scripts/tag_pyq_2026.mjs --report   # also prints coverage + samples of untagged questions
 *
 * Tagging is keyword based (English + Hindi), so it is approximate: a question with no keyword hit
 * stays untagged (-1) — that does NOT mean it is outside the syllabus.
 *
 * Output (`tags.json`), aligned with `index.json` `questions` order:
 *   { version, topics: string[], t: number[] (topic index or -1), ts: number[] (row indexes of
 *     time-sensitive questions) }
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pyqDir = path.join(root, 'public', 'pyq');
const report = process.argv.includes('--report');

// Sub-topic names must match src/data/syllabus.ts exactly.
// Rules are tried in order within a section; the first matching rule wins.
const RULES = {
  'General Awareness': [
    ['Basics of Computers & Environment', /\b(computer|software|hardware|cpu|ram|rom|keyboard|mouse|internet|e-?mail|byte|binary|operating system|ms[- ]?(word|excel|office|powerpoint)|excel|browser|url|html|virus|malware|lan|wan|modem|router|printer|monitor|shortcut key|ctrl|database|spreadsheet|pollution|ozone|greenhouse|climate change|global warming|biodiversity|ecosystem|wetland|ramsar|carbon|environment)\b|कंप्यूटर|कम्प्यूटर|सॉफ्टवेयर|इंटरनेट|ईमेल|प्रदूषण|ओजोन|पर्यावरण|जैव विविधता|पारिस्थितिकी|ग्रीनहाउस|जलवायु/i],
    ['Science & Technology (Space & Nuclear)', /\b(isro|nasa|satellite|chandrayaan|mangalyaan|gaganyaan|aditya-?l1|rocket|launch vehicle|pslv|gslv|orbit|space ?craft|nuclear|reactor|atomic energy|barc|drdo|missile|agni|prithvi|brahmos|akash|nag|tejas|interceptor)\b|इसरो|नासा|उपग्रह|चंद्रयान|मंगलयान|गगनयान|रॉकेट|परमाणु|मिसाइल|अंतरिक्ष/i],
    ['General Science (Physics, Chemistry, Biology - up to 10th CBSE)', /\b(acid|base|salt|ph|element|compound|atom|molecule|electron|proton|neutron|isotope|valency|periodic|metal|alloy|oxide|chemical|formula|reaction|gas|oxygen|hydrogen|nitrogen|carbon dioxide|velocity|acceleration|force|newton|gravity|mass|weight|density|pressure|energy|power|work done|heat|temperature|celsius|kelvin|sound|light|lens|mirror|refraction|reflection|magnet|current|voltage|resistance|ohm|watt|joule|wave|frequency|cell|tissue|organ|blood|heart|kidney|liver|lung|brain|vitamin|protein|disease|virus|bacteria|plant|photosynthesis|chlorophyll|hormone|gland|enzyme|dna|gene|chromosome|species|animal|human body|bone|digest|respirat|nerv|botan|zoolog|science|scientific|unit of|si unit|dB|decibel)\b|अम्ल|क्षार|लवण|तत्व|यौगिक|परमाणु|अणु|इलेक्ट्रॉन|प्रोटॉन|न्यूट्रॉन|धातु|मिश्रधातु|रासायनिक|अभिक्रिया|ऑक्सीजन|हाइड्रोजन|नाइट्रोजन|वेग|त्वरण|बल|गुरुत्व|द्रव्यमान|भार|घनत्व|दाब|ऊर्जा|शक्ति|ऊष्मा|तापमान|ध्वनि|प्रकाश|लेंस|दर्पण|अपवर्तन|परावर्तन|चुंबक|धारा|विभव|प्रतिरोध|तरंग|आवृत्ति|कोशिका|ऊतक|अंग|रक्त|हृदय|वृक्क|यकृत|फेफड़|मस्तिष्क|विटामिन|प्रोटीन|रोग|विषाणु|जीवाणु|पौध|प्रकाश संश्लेषण|हार्मोन|ग्रंथि|एंजाइम|गुणसूत्र|जीन|प्रजाति|मात्रक|विज्ञान/i],
    ['Indian Polity & Governance', /\b(constitution|article|amendment|schedule|parliament|lok sabha|rajya sabha|president|vice[- ]president|prime minister|governor|chief minister|supreme court|high court|judge|fundamental (right|dut)|directive principle|preamble|election commission|panchayat|municipal|cag|attorney general|speaker|bill|ordinance|writ|citizenship|union territory|state legislat|vidhan|governance)\b|संविधान|अनुच्छेद|संशोधन|अनुसूची|संसद|लोकसभा|राज्यसभा|राष्ट्रपति|उपराष्ट्रपति|प्रधानमंत्री|राज्यपाल|मुख्यमंत्री|सर्वोच्च न्यायालय|उच्च न्यायालय|न्यायाधीश|मौलिक अधिकार|मौलिक कर्तव्य|नीति निदेशक|प्रस्तावना|निर्वाचन आयोग|चुनाव आयोग|पंचायत|नगरपालिका|केंद्र शासित/i],
    ['Indian Economy', /\b(gdp|gnp|inflation|rbi|reserve bank|repo|monetary|fiscal|budget|tax|gst|bank|banking|nabard|sebi|stock|share market|sensex|nifty|economy|economic|five[- ]year plan|niti aayog|planning commission|poverty|unemployment|currency|rupee|export|import|trade|subsidy|yojana|scheme|mudra|jan dhan|msme|industr|finance|insurance|loan|interest rate)\b|सकल घरेलू|मुद्रास्फीति|रिज़र्व बैंक|रिजर्व बैंक|रेपो|मौद्रिक|राजकोषीय|बजट|कर |जीएसटी|बैंक|अर्थव्यवस्था|आर्थिक|पंचवर्षीय|नीति आयोग|योजना आयोग|गरीबी|बेरोजगारी|मुद्रा|रुपया|निर्यात|आयात|व्यापार|सब्सिडी|योजना|उद्योग|वित्त|बीमा|ऋण/i],
    ['Indian History & Freedom Struggle', /\b(mughal|akbar|babur|humayun|aurangzeb|shah jahan|jahangir|maurya|ashoka|chandragupta|gupta|harappa|indus valley|vedic|veda|buddha|buddhism|jain|mahavira|sultanate|delhi sultan|khilji|tughlaq|lodi|maratha|shivaji|vijayanagara|chola|pallava|chalukya|rashtrakuta|british|east india company|governor[- ]general|viceroy|revolt of 1857|sepoy|gandhi|nehru|subhas|bose|bhagat singh|tilak|gokhale|congress session|indian national congress|muslim league|quit india|non[- ]cooperation|civil disobedience|salt march|dandi|swadeshi|partition of bengal|jallianwala|simon commission|round table|freedom fighter|independence|battle of|dynasty|empire|king|emperor|ruler|reign|ancient|medieval|sangam|rajput)\b|मुगल|अकबर|बाबर|हुमायूं|औरंगजेब|शाहजहां|जहांगीर|मौर्य|अशोक|चंद्रगुप्त|गुप्त|हड़प्पा|सिंधु घाटी|वैदिक|वेद|बुद्ध|बौद्ध|जैन|महावीर|सल्तनत|खिलजी|तुगलक|लोदी|मराठा|शिवाजी|विजयनगर|चोल|पल्लव|चालुक्य|ब्रिटिश|ईस्ट इंडिया कंपनी|गवर्नर जनरल|वायसराय|1857|गांधी|नेहरू|सुभाष|भगत सिंह|तिलक|गोखले|कांग्रेस|मुस्लिम लीग|भारत छोड़ो|असहयोग|सविनय अवज्ञा|नमक सत्याग्रह|दांडी|स्वदेशी|बंगाल विभाजन|जलियांवाला|साइमन|गोलमेज|स्वतंत्रता|युद्ध|राजवंश|साम्राज्य|राजा|सम्राट|शासक|शासनकाल|प्राचीन|मध्यकालीन/i],
    ['Indian & World Geography', /\b(river|mountain|peak|hill|plateau|desert|ocean|sea|lake|island|strait|gulf|bay|continent|latitude|longitude|equator|tropic|climate|monsoon|rainfall|soil|forest|national park|wildlife sanctuary|tiger reserve|biosphere|dam|canal|port|mineral|coal|iron ore|crop|kharif|rabi|cultivat|population|census|state of|capital of|located|border|himalaya|ganga|ganges|godavari|krishna|narmada|kaveri|brahmaputra|earth|planet|solar system|volcano|earthquake|cyclone|atmosphere|latitude|map)\b|नदी|पर्वत|चोटी|पहाड़|पठार|मरुस्थल|रेगिस्तान|महासागर|सागर|झील|द्वीप|जलडमरूमध्य|खाड़ी|महाद्वीप|अक्षांश|देशांतर|भूमध्य रेखा|कर्क रेखा|मकर रेखा|जलवायु|मानसून|वर्षा|मिट्टी|मृदा|वन|राष्ट्रीय उद्यान|अभयारण्य|बाघ अभयारण्य|बांध|नहर|बंदरगाह|खनिज|कोयला|लौह अयस्क|फसल|खरीफ|रबी|जनसंख्या|जनगणना|राजधानी|स्थित|सीमा|हिमालय|गंगा|गोदावरी|कृष्णा|नर्मदा|कावेरी|ब्रह्मपुत्र|पृथ्वी|ग्रह|सौर मंडल|ज्वालामुखी|भूकंप|चक्रवात|वायुमंडल/i],
    ['Static GK (Art & Culture, Awards, Sports, Books, Monuments)', /\b(award|prize|bharat ratna|padma|nobel|oscar|booker|dadasaheb|arjuna|khel ratna|dronacharya|jnanpith|sahitya akademi|book|author|wrote|written by|novel|autobiography|poet|dance|music|classical|folk|festival|temple|fort|monument|stupa|cave|painting|art form|instrument|sitar|tabla|tribe|cricket|football|hockey|tennis|badminton|chess|olympic|commonwealth|asian games|world cup|trophy|cup|stadium|player|athlete|medal|championship|tournament|day is observed|day is celebrated|observed on|celebrated on|national (animal|bird|flower|tree|song|anthem)|headquarter|founded|founder|unesco|heritage)\b|पुरस्कार|भारत रत्न|पद्म|नोबेल|ऑस्कर|बुकर|दादासाहेब|अर्जुन|खेल रत्न|द्रोणाचार्य|ज्ञानपीठ|साहित्य अकादमी|पुस्तक|लेखक|लिखा|उपन्यास|आत्मकथा|कवि|नृत्य|संगीत|शास्त्रीय|लोक|त्योहार|उत्सव|मंदिर|किला|स्मारक|स्तूप|गुफा|चित्रकला|वाद्य|सितार|तबला|जनजाति|क्रिकेट|फुटबॉल|हॉकी|टेनिस|बैडमिंटन|शतरंज|ओलंपिक|राष्ट्रमंडल|एशियाई खेल|विश्व कप|ट्रॉफी|खिलाड़ी|पदक|चैंपियनशिप|टूर्नामेंट|दिवस|मनाया|मुख्यालय|स्थापना|संस्थापक|यूनेस्को|विरासत/i],
    ['Current Affairs (National & International)', /\b(20(1[5-9]|2\d)|recently|current|latest|newly|launched|appointed|summit|g20|g7|brics|sco|quad|united nations|un |who |imf|world bank|wto|asean|saarc|nato|minister|ministry|government of india|mission|campaign|abhiyan|policy)\b|हाल ही|हाल में|वर्तमान|नवीनतम|नियुक्त|शिखर सम्मेलन|संयुक्त राष्ट्र|विश्व बैंक|मंत्री|मंत्रालय|भारत सरकार|मिशन|अभियान|नीति/i],
  ],
  Mathematics: [
    ['Data Interpretation', /\b(table|bar graph|bar chart|pie chart|pie-chart|line graph|histogram|the (following )?(graph|chart)|given (graph|chart|data)|study the|data given)\b|तालिका|दंड आलेख|बार ग्राफ|पाई चार्ट|वृत्त आरेख|रेखा आलेख|आलेख|ग्राफ|आंकड़|आँकड़/i],
    ['Simple & Compound Interest', /\b(interest|compound|principal|per annum|p\.a\.|compounded)\b|ब्याज|चक्रवृद्धि|मूलधन|प्रति वर्ष की दर|वार्षिक दर/i],
    ['Profit & Loss', /\b(profit|loss|cost price|selling price|discount|marked price|list price|gain|shopkeeper|dealer|c\.p\.|s\.p\.)\b|लाभ|हानि|क्रय मूल्य|विक्रय मूल्य|बट्टा|छूट|अंकित मूल्य|दुकानदार|व्यापारी/i],
    ['Time, Speed & Distance', /\b(speed|km\/h|km\/hr|kmph|m\/s|train|boat|stream|upstream|downstream|distance|journey|travel|race|overtake|cross(es)? a (pole|platform|man|bridge))\b|चाल|गति|किमी\/घंटा|ट्रेन|रेलगाड़ी|नाव|धारा|दूरी|यात्रा|दौड़/i],
    ['Time & Work', /\b(work|days|pipe|tap|cistern|tank|fill|empty|efficiency|men can|women can|together)\b|कार्य|काम|दिनों|पाइप|नल|टंकी|भरने|भर सकत|खाली कर|दक्षता|मिलकर/i],
    ['Mensuration (2D & 3D)', /\b(area|perimeter|volume|surface area|curved surface|cylinder|cone|sphere|hemisphere|cube(?! root)|cuboid|prism|pyramid|radius|diameter|circumference|rectangle|square(?! root)|rhombus|trapezium|parallelogram|frustum|cm²|cm³|cm2|cm3|m²|m³|sq\.? ?(cm|m))\b|क्षेत्रफल|परिमाप|आयतन|पृष्ठीय|वक्र पृष्ठ|बेलन|शंकु|गोला|गोलार्ध|घनाकार|घनाभ|घन (सेमी|मी)|प्रिज्म|पिरामिड|त्रिज्या|व्यास|परिधि|आयत|वर्गाकार|वर्ग (सेमी|मी)|समचतुर्भुज|समलंब|समांतर चतुर्भुज|छिन्नक/i],
    ['Geometry & Trigonometry', /\b(sin|cos|tan|cot|sec|cosec|θ|angle|triangle|circle|chord|tangent|quadrilateral|polygon|parallel lines|bisector|perpendicular|congruent|similar|centroid|orthocentre|incentre|circumcentre|altitude|median|hypotenuse|pythagoras|elevation|depression|∠|°)\b|त्रिकोण|कोण|त्रिभुज|वृत्त|जीवा|स्पर्श रेखा|चतुर्भुज|बहुभुज|समांतर रेखा|समद्विभाजक|लंब|सर्वांगसम|समरूप|केन्द्रक|केंद्रक|लंबकेंद्र|अंतःकेंद्र|परिकेंद्र|माध्यिका|कर्ण|पाइथागोरस|उन्नयन|अवनमन|∠|°/i],
    ['Elementary Statistics', /\b(average|mean|median|mode|range|standard deviation|variance|frequency|observations)\b|औसत|माध्य|माध्यिका|बहुलक|परिसर|मानक विचलन|प्रसरण|बारंबारता|प्रेक्षण/i],
    ['Percentage', /\b(percent|percentage|%)|प्रतिशत|%/i],
    ['Ratio & Proportion', /\b(ratio|proportion|share|partner|partnership|mixture|alloy|age|years ago|years hence|older|younger|divided in)\b|अनुपात|समानुपात|हिस्सा|साझेदार|साझेदारी|मिश्रण|मिश्रधातु|आयु|उम्र|वर्ष पहले|वर्ष बाद|बाँटा|बांटा/i],
    ['LCM & HCF', /\b(lcm|hcf|l\.c\.m|h\.c\.f|gcd|least common multiple|highest common factor|greatest common divisor)\b|लघुत्तम|महत्तम|ल\.स\.प|म\.स\.प/i],
    ['Decimals & Fractions', /\b(decimal|fraction|recurring|numerator|denominator|0\.\d)\b|दशमलव|भिन्न/i],
    ['Number System', /\b(divisible|divisibility|prime|composite|remainder|divided by|unit digit|units digit|factors|natural numbers|whole numbers|integers|even|odd|number of zeros|smallest number|largest number|greatest number|digit)\b|विभाज्य|अभाज्य|भाज्य|शेषफल|शेष|इकाई अंक|गुणनखंड|प्राकृत संख्या|पूर्ण संख्या|पूर्णांक|सम संख्या|विषम संख्या|सबसे छोटी संख्या|सबसे बड़ी संख्या|अंक/i],
    ['Elementary Algebra', /\b(x|y|equation|polynomial|algebra|root|quadratic|expression|factor|identity|linear|solve)\b|समीकरण|बहुपद|बीजगणित|मूल|द्विघात|व्यंजक|गुणनखंड|सर्वसमिका|रैखिक/i],
    ['Simplification & BODMAS', /\b(simplify|simplification|value of|evaluate|bodmas|√|÷|×)|सरल|मान ज्ञात|√|÷|×/i],
  ],
  'General Intelligence & Reasoning': [
    ['Syllogism', /\b(statements?:?.*conclusions?|syllogism)\b|कथन.*निष्कर्ष|न्याय निगमन/i],
    ['Statement-Conclusion & Courses of Action', /\b(course of action|courses of action|assumption|argument|assertion|statement.*(follow|implicit))\b|कार्यवाही|पूर्वधारणा|अभिकथन|कथन/i],
    ['Data Sufficiency', /\b(data sufficiency|sufficient to answer|is\/are sufficient|statements? (i|1) (and|or) (ii|2))\b|पर्याप्त/i],
    ['Decision Making', /\b(decision making|decide|eligib|criteria|conditions? for selection)\b|निर्णय|पात्रता|मानदंड/i],
    ['Blood Relations', /\b(father|mother|son|daughter|brother|sister|husband|wife|uncle|aunt|nephew|niece|grandfather|grandmother|cousin|grandson|granddaughter|son-in-law|daughter-in-law|mother-in-law|father-in-law)\b|पिता|माता|माँ|पुत्र|बेटा|पुत्री|बेटी|भाई|बहन|पति|पत्नी|चाचा|मामा|चाची|मामी|भतीजा|भतीजी|भांजा|भांजी|दादा|दादी|नाना|नानी|ससुर|सास|दामाद|बहू/i],
    ['Puzzles', /\b(sitting|seated|sit (around|in)|circular table|facing (the )?(centre|center)|floor|building|box(es)?|persons? [a-z], [a-z]|puzzle|arrangement|arranged|immediate (left|right)|second to the|day of the week|calendar|clock|o'?clock|leap year|angle between the hands)\b|बैठे|बैठा|बैठी|वृत्ताकार|मेज|मंजिल|इमारत|बॉक्स|पहेली|व्यवस्था|व्यवस्थित|ठीक बाएं|ठीक दाएं|सप्ताह|कैलेंडर|घड़ी|बजे|लीप वर्ष/i],
    ['Number & Alphabet Series', /\b((number|symbol|letter|alphanumeric)( and (number|symbol|letter))? series)\b|प्रतीक श्रृंखला|संख्या.{0,20}श्रृंखला|अक्षर.{0,20}श्रृंखला/i],
    ['Direction & Distance', /\b(north|south|east|west|direction|turns? (left|right)|km (to|towards))\b|दक्षिण|पश्चिम|दिशा|मुड़|उत्तर (की ओर|दिशा)|पूर्व (की ओर|दिशा)/i],
    ['Ranking', /\b(rank|ranked|position from|from the (left|right|top|bottom)|row of|in a row|in a queue|taller|shortest|tallest|heaviest|lightest)\b|रैंक|बाएं से|दाएं से|बाईं ओर से|दाईं ओर से|पंक्ति|कतार|लंबा|सबसे छोटा|सबसे भारी|सबसे हल्का/i],
    ['Venn Diagrams', /\b(venn|diagram (best )?represents|best represents the relationship)\b|वेन|आरेख/i],
    ['Mathematical Operations', /(\+|−|-|×|÷).*(means|interchanged|interchange|stands for|denotes|represents)|(means|denotes|stands for).*(\+|−|×|÷)|correct equation|mathematical (operation|sign)|interchange(d)? (the )?(two )?(signs|numbers)|का अर्थ|चिह्नों|चिन्हों|परस्पर बदल/i],
    ['Coding-Decoding', /\b[A-Z]{3,}\b\s*(=|is|:|as|को)\s*['‘]?[A-Z0-9]{3,}/, /\b(code|coded|coding|code language|written as|is written|decod)\b|कूट|कोड|कूटबद्ध|भाषा में|लिखा जाता/i],
    ['Analogies', /\b(analog|related to .* in the same way|same way as|::|is to)\b|उसी प्रकार|उसी तरह|::|संबंधित है/i],
    ['Jumbling', /\b(meaningful (word|order|sequence)|dictionary|arrange (the )?(following )?words|logical (order|sequence)|jumbled)\b|शब्दकोश|सार्थक|तार्किक क्रम|व्यवस्थित कीजिए/i],
    ['Similarities & Differences', /\b(odd one|odd man|does not belong|three of the following|alike|different from the (others|rest)|classification)\b|विषम|असंगत|भिन्न है|तीन .* समान|समान हैं|वर्गीकरण/i],
    ['Analytical Reasoning', /\b(figure|mirror image|water image|embedded|count the (number of )?(triangles|squares)|paper (is )?folded|dice|cube|pattern)\b|आकृति|दर्पण प्रतिबिंब|जल प्रतिबिंब|त्रिभुजों की संख्या|वर्गों की संख्या|कागज|पासा|घन|पैटर्न/i],
    ['Number & Alphabet Series', /\b(series|sequence|next term|missing (number|term)|wrong (number|term)|come next|replace the question mark|\?)\b|श्रृंखला|श्रेणी|अनुक्रम|अगला पद|लुप्त|प्रश्न-?चि(ह्न|न्ह)|\?/i],
  ],
};

// Time-sensitive GA: answers that depend on when the question was asked (office holders, "latest",
// recent events, rankings, editions of recurring events). Applied to General Awareness only.
const TIME_SENSITIVE =
  /\b(recently|currently|current (chief|president|governor|ceo|chairman|captain|head|minister|secretary)|presently|latest|newly|new (chief|president|governor|ceo|chairman|director|head)|incumbent|as of|as on|this year|last year|appointed|elected|sworn in|took (oath|charge)|took over|who is the (chief|president|prime|governor|ceo|chairman|captain|director|head|secretary|minister|speaker|vice)|(chief minister|governor|ceo|chairman|chairperson|managing director|director general|captain|coach|secretary[- ]general|brand ambassador) of|won the .*(20\d\d)|(20(1[5-9]|2[0-6]))|edition|will host|ranked|ranking|report released|unveiled|signed an? (mou|agreement))\b|हाल ही|हाल में|वर्तमान|वर्तमान में|नवीनतम|नए|नियुक्त|निर्वाचित|शपथ|पदभार|के मुख्यमंत्री|के राज्यपाल|के सीईओ|के अध्यक्ष|के कप्तान|के कोच|ब्रांड एंबेसडर|ब्रांड एम्बेसडर|संस्करण|मेजबानी करेगा|रैंक|रैंकिंग|रिपोर्ट|समझौता|20(1[5-9]|2[0-6])/i;

// JS \b does not work for Devanagari, so Hindi keywords would match inside longer words
// ("भार" weight inside "भारत" India, "अंग" organ inside "अंग्रेजी"). Give every top-level Hindi
// alternative a start boundary, and short ones (≤ 3 code units) an end boundary too.
const DEV = '\\u0900-\\u097F';
function splitTopLevel(src) {
  const parts = [];
  let depth = 0;
  let cls = false;
  let cur = '';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') {
      cur += ch + (src[i + 1] ?? '');
      i += 1;
      continue;
    }
    if (cls) cls = ch !== ']';
    else if (ch === '[') cls = true;
    else if (ch === '(') depth += 1;
    else if (ch === ')') depth -= 1;
    else if (ch === '|' && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}
function hindiBoundaries(re) {
  const parts = splitTopLevel(re.source).map((alt) => {
    if (!/^[ऀ-ॿ]/.test(alt)) return alt;
    const plain = /^[ऀ-ॿ]+$/.test(alt);
    return `(?<![${DEV}])${alt}${plain && alt.length <= 3 ? `(?![${DEV}])` : ''}`;
  });
  return new RegExp(parts.join('|'), re.flags);
}
for (const rules of Object.values(RULES)) {
  for (const rule of rules) for (let k = 1; k < rule.length; k++) rule[k] = hindiBoundaries(rule[k]);
}
const TIME_SENSITIVE_RE = hindiBoundaries(TIME_SENSITIVE);

const index = JSON.parse(fs.readFileSync(path.join(pyqDir, 'index.json'), 'utf8'));
const topics = Array.from(new Set(Object.values(RULES).flatMap((rules) => rules.map(([name]) => name))));
const topicIdx = new Map(topics.map((t, i) => [t, i]));

const bodies = new Map();
for (const chunk of index.chunks) {
  for (const b of JSON.parse(fs.readFileSync(path.join(pyqDir, 'c', `${chunk}.json`), 'utf8'))) {
    bodies.set(b.id, b);
  }
}

const t = [];
const ts = [];
const stats = {};
const untaggedSamples = {};
index.questions.forEach((row, i) => {
  const [id, , cat] = row;
  const category = index.cats[cat];
  const body = bodies.get(id);
  const text = body ? `${body.q} ${body.p ?? ''}` : '';
  const withOptions = body ? `${text} ${body.o.join(' ')}` : '';
  const rules = RULES[category] ?? [];
  // Prefer a match on the question text; fall back to question + options.
  const matches = (res, s) => res.some((re) => re.test(s));
  let hit = rules.find(([, ...res]) => matches(res, text)) ?? rules.find(([, ...res]) => matches(res, withOptions));
  t.push(hit ? topicIdx.get(hit[0]) : -1);
  if (category === 'General Awareness' && TIME_SENSITIVE_RE.test(text)) ts.push(i);

  const s = (stats[category] ??= { total: 0, tagged: 0, timeSensitive: 0, byTopic: {} });
  s.total += 1;
  if (hit) {
    s.tagged += 1;
    s.byTopic[hit[0]] = (s.byTopic[hit[0]] ?? 0) + 1;
  } else if ((untaggedSamples[category] ??= []).length < 12) {
    untaggedSamples[category].push(text.slice(0, 110).replace(/\s+/g, ' '));
  }
  if (category === 'General Awareness' && ts[ts.length - 1] === i) s.timeSensitive += 1;
});

fs.writeFileSync(path.join(pyqDir, 'tags.json'), JSON.stringify({ version: 1, topics, t, ts }));
for (const [cat, s] of Object.entries(stats)) {
  console.log(
    `${cat}: ${s.tagged}/${s.total} tagged (${((100 * s.tagged) / s.total).toFixed(1)}%)` +
      (cat === 'General Awareness' ? `, ${s.timeSensitive} time-sensitive` : ''),
  );
  if (report) {
    for (const [topic, n] of Object.entries(s.byTopic).sort((a, b) => b[1] - a[1])) console.log(`   ${n}\t${topic}`);
    for (const q of untaggedSamples[cat] ?? []) console.log(`   ? ${q}`);
  }
}
console.log(`wrote public/pyq/tags.json (${topics.length} topics, ${t.length} questions)`);
