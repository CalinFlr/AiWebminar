# Ziua 1 - Outline slide-by-slide

> Status: v1 pentru validare narativa.
> Scop: stabilim ordinea, ritmul si rolul slide-urilor inainte sa generam deck-ul JSON final.

## Principiu

Ziua 1 trebuie sa faca un lucru foarte clar:

**Participantul trece de la "folosesc ChatGPT cand imi amintesc" la "plec cu harta primului meu agent AI".**

Nu construim inca tot sistemul. Construim baza:

1. intelegem diferenta dintre chat si workflow;
2. vedem harta unui sistem de agenti prin cazul Petru;
3. alegem prima misiune a agentului;
4. o transformam in Harta Primului Agent AI;
5. rulam o mini-demo in Claude;
6. generalizam metoda pe orice business.

## Decizie de ritm

Recomandare: aproximativ **28-32 slide-uri** pentru 90 de minute.

De ce:

- suficient de multe ca sa nu inghesuim informatia;
- suficient de putine ca sa ramana prezentare live, nu curs citit;
- fiecare bloc de 10-15 minute are 3-5 slide-uri;
- demo-ul ramane respirabil, nu sufocat de teorie.

Contra:

- cere disciplina la script: unele slide-uri trebuie sa fie ancore vizuale, nu pagini de continut;
- daca adaugam prea multe exemple pe fiecare slide, deck-ul devine workbook.

## Structura propusa

### Bloc 1 - Deschidere si promisiune, 0-10 min

#### Slide 01 - Hero Ziua 1

- Tip engine: `hero`
- Mesaj: De la ChatGPT la harta primului tau agent AI.
- Rol: seteaza promisiunea zilei si tonul premium/practic.
- Continut pe slide:
  - Ziua 1
  - De la ChatGPT la harta primului tau agent AI
  - Alegem misiunea corecta inainte sa ii dam agentului putere
  - 90 min + Q&A
- Speaker note: promitem senzatia de magie, dar livram metoda: un agent bun nu incepe cu un prompt, incepe cu o harta.

#### Slide 02 - Ce construim in cele 4 zile

- Tip engine: `process-map`
- Mesaj: proces -> harta -> skill -> agent -> orchestrator.
- Rol: arata traseul complet, dar clarifica faptul ca azi suntem la primele doua piese.
- Accent vizual: `Harta` este highlight-ul zilei.
- Speaker note: skill, MCP si browser automation apar ca progresie, nu ca jargon aruncat.

#### Slide 03 - Ce nu facem azi

- Tip engine: `compare`
- Mesaj: nu cautam tool secret, nu facem autopilot, nu construim tot sistemul.
- Rol: curata asteptarile si diferentiaza workshopul de promisiunile exagerate.
- Continut:
  - Nu: agent care decide singur
  - Nu: prompt random
  - Nu: instalare live cap-coada
  - Da: misiune clara, reguli simple, rezultat dorit, om la buton

#### Slide 04 - Formula zilei

- Tip engine: `section`
- Mesaj: ce treaba ii dam agentului, cu ce porneste, ce trebuie sa livreze si unde apasam noi OK?
- Rol: introduce intrebarea care revine pe tot parcursul zilei.
- Speaker note: aceasta formula devine ancora pentru orice business.

### Bloc 2 - Cazul Petru si harta agentilor, 10-20 min

#### Slide 05 - Sandbox-ul: Petru

- Tip engine: `section`
- Mesaj: Petru este fitness trainer pe nisa `fit dads`.
- Rol: da un caz concret, usor de urmarit.
- Continut:
  - tați ocupati;
  - timp putin;
  - energie, greutate, control;
  - continut, newsletter, ads.

#### Slide 06 - Petru nu are nevoie de un prompt

- Tip engine: `agent-map`
- Mesaj: Petru are nevoie de o echipa de agenti.
- Rol: primul moment wow controlat.
- Agenti:
  - research scripturi;
  - postare continut;
  - newsletter;
  - research ads;
  - supraveghere ads.
- Speaker note: spunem explicit ca nu construim toate acestea azi.

#### Slide 07 - Research-ul este fundatia

- Tip engine: `process-map`
- Mesaj: research -> content -> newsletter -> ads -> supraveghere.
- Rol: arata de ce alegem primul proces corect.
- Speaker note: daca research-ul este slab, toate celelalte ies slabe.

#### Slide 08 - De la harta mare la prima piesa

- Tip engine: `section`
- Mesaj: azi alegem un singur proces: research si directie pentru `fit dads`.
- Rol: reduce complexitatea dupa momentul wow.
- Speaker note: asta pastreaza workshopul practic si urmaribil.

### Bloc 3 - Setup si spatiul de lucru, 20-30 min

#### Slide 09 - Unde lucram azi

- Tip engine: `section`
- Mesaj: lucram in Claude Desktop, cu fallback in browser.
- Rol: clarifica mediul fara sa transforme sesiunea in instalare.
- Continut:
  - Claude Desktop instalat la prezentator;
  - participantii primesc video separat pentru instalare;
  - fallback: Claude/ChatGPT in browser.

#### Slide 10 - Instalarea nu este workshopul

- Tip engine: `compare`
- Mesaj: nu consumam energia live pe debugging individual.
- Rol: argumenteaza decizia de a nu instala live.
- Pro:
  - pastram energia pentru metoda;
  - toti pot urmari chiar daca nu au setup complet.
- Contra:
  - unii vor avea setup de facut separat;
  - trebuie sa existe video pre-work bun.

#### Slide 11 - Ce inseamna setup corect

- Tip engine: `brief-table`
- Mesaj: participantul trebuie sa stie ce ar trebui sa vada cand setup-ul e ok.
- Randuri:
  - aplicatie deschisa;
  - login facut;
  - poate crea conversatie/proiect;
  - poate lipi prompt si primi raspuns;
  - stie fallback-ul.

### Bloc 4 - Chat simplu vs workspace AI, 30-40 min

#### Slide 12 - Chat simplu

- Tip engine: `compare`
- Mesaj: un chat izolat ajuta o data, dar nu devine sistem.
- Rol: porneste de la experienta pe care o stiu deja participantii.
- Continut:
  - intrebare punctuala;
  - context uitat;
  - raspuns greu de refolosit;
  - calitate variabila.

#### Slide 13 - Workspace AI

- Tip engine: `compare`
- Mesaj: cand treaba devine sistem, AI-ul are rol, context, limite, rezultat dorit si om la buton.
- Rol: introduce diferenta de maturitate.
- Continut:
  - context pastrat;
  - materiale;
  - limite clare;
  - criterii de calitate;
  - OK final de la om.

#### Slide 14 - De ce conteaza asta in business

- Tip engine: `section`
- Mesaj: businessul nu are nevoie doar de raspunsuri, ci de procese repetabile.
- Rol: leaga partea tehnica de timp, bani, oameni si calitate.
- Speaker note: aici se poate face prima generalizare scurta in afara cazului Petru.

### Bloc 5 - Alegem prima misiune a agentului, 40-55 min

#### Slide 15 - Capcana: vreau agent pentru tot

- Tip engine: `section`
- Mesaj: "vreau agent pentru business" este prea vag.
- Rol: ii ajuta pe participanti sa inteleaga de ce ingustam scope-ul.
- Speaker note: vag inseamna greu de evaluat, greu de repetat, greu de controlat.

#### Slide 16 - Lista agentilor lui Petru, vazuta ca procese

- Tip engine: `brief-table`
- Mesaj: fiecare agent are un proces in spate.
- Randuri:
  - research scripturi -> research nisa si directie;
  - postare continut -> distributie si checklist;
  - newsletter -> educatie si follow-up;
  - research ads -> unghiuri si exemple;
  - supraveghere ads -> metrici si recomandari.

#### Slide 17 - Alegerea pentru Ziua 1

- Tip engine: `section`
- Mesaj: prima misiune este research si directie pentru `fit dads`.
- Rol: decizie clara pentru demo.
- Argumente:
  - hraneste postari;
  - hraneste newsletter;
  - hraneste ads;
  - reduce raspunsurile generice.

#### Slide 18 - Ce vrem sa scoata agentul

- Tip engine: `brief-table`
- Mesaj: definim ce vrem sa scoata agentul inainte sa ii cerem magie.
- Randuri:
  - avatar;
  - probleme;
  - dorinte;
  - obiectii;
  - hook-uri;
  - idei de scripturi;
  - checklist pentru OK final.

### Bloc 6 - Harta Primului Agent AI, 55-70 min

#### Slide 19 - Harta Primului Agent AI

- Tip engine: `brief-table`
- Mesaj: harta care transforma o idee vaga intr-un agent pe care il poti controla.
- Rol: slide ancora al zilei.
- Randuri:
  - Misiunea agentului;
  - Ce primeste la inceput;
  - Cum faci acum manual;
  - Ce trebuie sa livreze;
  - Ce nu are voie sa faca;
  - Unde apesi tu OK;
  - Ce castigi.

#### Slide 20 - Harta lui Petru: misiune si pornire

- Tip engine: `brief-table`
- Mesaj: completam prima parte a hartii pe cazul Petru.
- Randuri:
  - Misiune: research si directie pentru `fit dads`;
  - Pornire: nisa, obiectiv, canale, limite;
  - Context: video scurt, newsletter, ads.

#### Slide 21 - Harta lui Petru: rezultat si limite

- Tip engine: `brief-table`
- Mesaj: agentul trebuie sa stie ce livreaza si ce nu are voie sa faca.
- Randuri:
  - Rezultat: avatar, probleme, obiectii, hook-uri, scripturi;
  - Limita: fara promisiuni agresive;
  - Limita: fara limbaj medical;
  - Limita: marcheaza presupunerile.

#### Slide 22 - Harta lui Petru: omul la buton si castigul

- Tip engine: `brief-table`
- Mesaj: omul ramane in bucla.
- Randuri:
  - OK final: Petru aproba directia;
  - OK final: promisiuni realiste;
  - Castig: continut mai relevant;
  - Castig: baza pentru newsletter si ads.

#### Slide 23 - Testul unei harti bune

- Tip engine: `compare`
- Mesaj: o harta buna este clara, repetata, usor de judecat si sub control.
- Rol: ii pregateste pe participanti pentru tema.
- Speaker note: daca pica la unul dintre cele 4 teste, procesul trebuie ingustat.

### Bloc 7 - Mini-demo Claude, 70-80 min

#### Slide 24 - Acum punem harta la lucru

- Tip engine: `section`
- Mesaj: promptul nu apare din aer, vine din harta.
- Rol: tranzitie spre demo live.
- Speaker note: aici se deschide Claude si se lipeste promptul rafinat de prezentator.

#### Slide 25 - Ce urmarim in raspuns

- Tip engine: `brief-table`
- Mesaj: nu ne uitam doar daca textul suna bine, ci daca respecta harta.
- Randuri:
  - avatar clar;
  - probleme reale;
  - obiectii comerciale;
  - hook-uri specifice;
  - scripturi folosibile;
  - presupuneri marcate;
  - OK final de la om.

#### Slide 26 - Comentam raspunsul ca owner, nu ca fan AI

- Tip engine: `section`
- Mesaj: AI-ul pregateste, omul valideaza.
- Rol: pastreaza pozitionarea responsabila.
- Speaker note: intreaba "ce as folosi?", "ce as taia?", "ce trebuie verificat?"

### Bloc 8 - Teaser wow si generalizare, 80-87 min

#### Slide 27 - Ce urmeaza in zilele urmatoare

- Tip engine: `process-map`
- Mesaj: harta devine skill, apoi agent, apoi sistem cu unelte.
- Rol: teaser pentru Ziua 2 si Ziua 3.
- Pasi:
  - Skill = reteta reutilizabila;
  - Agent = rol specializat;
  - MCP = acces controlat la unelte/context;
  - Browser/Playwright = verificare in browser pe informatii publice;
  - Orchestrator = coordonare intre agenti.

#### Slide 28 - Dovada secundara: cabinet/clinica

- Tip engine: `compare`
- Mesaj: metoda nu este doar pentru fitness.
- Rol: creste credibilitatea pentru businessuri locale.
- Continut:
  - nu AI face medicina;
  - da: intrebari repetitive;
  - da: programari;
  - da: remindere;
  - da: continut educational fara date sensibile.

#### Slide 29 - Orice business

- Tip engine: `compare`
- Mesaj: aceeasi intrebare se aplica peste tot.
- Rol: fixeaza generalizarea.
- Cazuri:
  - Petru / continut;
  - cabinet / intrebari si programari;
  - consultant / sumar si follow-up;
  - agentie / research si livrare;
  - e-commerce / produse si suport.

#### Slide 30 - Cele 4 beneficii

- Tip engine: `compare`
- Mesaj: timp, bani, munca repetitiva/angajari, calitate.
- Rol: inchiderea economica a zilei.
- Speaker note: repeta explicit ca acestea sunt efectele unui proces clar, nu ale unui tool magic.

### Bloc 9 - Tema si hook Ziua 2, 87-90 min

#### Slide 31 - Tema Zilei 1

- Tip engine: `closing`
- Mesaj: completeaza Harta Primului Agent AI pentru businessul tau.
- Rol: muta participantul din spectator in aplicare.
- Continut:
  - alege un proces specific;
  - completeaza misiunea, pornirea, pasii, rezultatul, limitele, OK-ul final si castigul;
  - nu trimite date sensibile.

#### Slide 32 - Maine il transformam in Skill

- Tip engine: `closing`
- Mesaj: procesul tau devine o reteta reutilizabila pentru AI.
- Rol: hook pentru Ziua 2.
- Speaker note: Ziua 2 incepe cu recap pe harti si trece spre Skill Card + Agent Role Card.

## Ce trebuie decis inainte de JSON

Prima decizie recomandata:

**Ramanem cu 32 de slide-uri pentru Ziua 1 v1 sau comprimam la aproximativ 24-26 slide-uri?**

Argument pentru 32:

- ritm mai aerisit;
- fiecare idee are propriul cadru vizual;
- mai bun pentru live, pentru ca nu citesti slide-uri dense.

Argument pentru 24-26:

- deck mai scurt;
- mai putin de navigat;
- dar creste riscul ca unele slide-uri sa devina prea incarcate.

Recomandarea mea: **pastram 32 pentru prima versiune**, apoi taiem dupa ce vedem deck-ul randat.
