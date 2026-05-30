# Ziua 1 - Mini-demo Claude pentru Petru / `fit dads`

> Status: v1 de lucru.
> Scop: script exact pentru demo-ul de 10 minute din Ziua 1.

## Rolul demo-ului

Demo-ul trebuie să arate că AI-ul nu este doar un generator de texte, ci poate deveni un spațiu de lucru care transformă un proces neclar într-o direcție de business.

Nu demonstrăm încă agent complet, skill, MCP sau Playwright. Le pregătim mental.

Mesaj:

**Înainte să construim agentul, trebuie să știm ce proces îi dăm, ce input are, ce output vrem și unde verifică omul.**

## Rezultat dorit în 10 minute

La finalul demo-ului, participanții trebuie să vadă un prim output pentru Petru:

- avatar `fit dads`;
- probleme recurente;
- dorințe;
- obiecții;
- unghiuri de conținut;
- hook-uri video;
- 3 idei de scripturi scurte;
- checklist de verificare umană.

## Structura demo-ului

| Minut | Ce se întâmplă | Efect dorit |
|---|---|---|
| 0-1 | Reamintim Workflow Brief v1 | Oamenii văd că promptul nu apare din aer. |
| 1-2 | Introducem cazul Petru | Context concret, nu teorie. |
| 2-4 | Lipim promptul în Claude | Demonstrație simplă, urmărită ușor. |
| 4-7 | Citim și comentăm outputul | Arătăm valoarea: research -> direcție -> conținut. |
| 7-9 | Marcăm verificarea umană | Poziționare sigură: AI pregătește, omul aprobă. |
| 9-10 | Generalizăm pe orice business | Timp, bani, oameni, calitate. |

## Script live

### Minutul 0-1 - Legătura cu Workflow Brief

Spui:

> Acum luăm Workflow Brief-ul lui Petru și îl punem la lucru. Observați ceva important: nu încep cu „scrie-mi 10 postări”. Încep cu procesul. Vreau să știm pentru cine vorbim, ce probleme are publicul, ce obiecții apar și ce ar trebui verificat înainte ca Petru să folosească outputul.

Punct de accent:

> Asta este diferența dintre un prompt izolat și începutul unui workflow.

### Minutul 1-2 - Cazul Petru

Spui:

> Petru este fitness trainer și vrea să se poziționeze pe nișa `fit dads`: tați ocupați care vor să fie în formă, dar au job, familie, puțin timp și multe încercări începute și abandonate.

> Pe termen lung, Petru are nevoie de mai mulți agenți: research, postare, newsletter, ads și supraveghere ads. Dar astăzi nu construim echipa completă. Începem cu fundația: agentul de research și direcție.

Punct de accent:

> Dacă research-ul este slab, toate celelalte ies slabe: postări, newsletter, ads, tot.

### Minutul 2-4 - Promptul pentru Claude

Spui:

> Acum îi dau lui Claude un brief foarte clar. Nu îi cer să ghicească businessul. Îi dau rol, context, output și limite.

Prompt de lipit în Claude:

```text
Lucrează ca un strategist de conținut și research pentru un fitness trainer.

Context:
- Trainerul se numește Petru.
- Nișa lui este "fit dads": tați ocupați care vor să slăbească, să aibă energie și să se simtă din nou în control, fără să trăiască în sală.
- Petru vrea să creeze conținut video scurt, newsletter și ulterior reclame.
- Publicul este non-medical. Nu vrem promisiuni agresive, rezultate garantate sau sfaturi medicale.

Procesul pe care îl lucrăm:
Research și direcție de conținut pentru nișa "fit dads".

Te rog să produci:
1. Un avatar clar pentru "fit dads".
2. 5 probleme recurente ale acestui public.
3. 5 dorințe emoționale și practice.
4. 5 obiecții care îi împiedică să înceapă.
5. 10 hook-uri pentru video-uri scurte.
6. 3 idei de scripturi video scurte, fiecare cu: hook, idee principală, structură în 3 pași și CTA soft.
7. O listă cu ce trebuie să verifice Petru înainte să folosească aceste idei.

Reguli:
- Nu inventa rezultate garantate.
- Nu folosi limbaj medical.
- Nu promite transformări rapide.
- Marchează clar unde ai făcut presupuneri.
- Scrie în română, pe înțelesul unui owner non-tehnic.
```

După ce rulează promptul, spui:

> Observați că aici deja avem reguli și limite. Nu vrem un AI care publică orice. Vrem un AI care pregătește material bun, dar controlabil.

## Cum explici outputul

### Avatarul

Spui:

> Avatarul este important pentru că AI-ul trebuie să știe cu cine vorbește. Dacă publicul e vag, și conținutul devine vag.

Ce urmărești în output:

- vârstă aproximativă;
- program aglomerat;
- familie;
- lipsă de timp;
- dorință de energie și control;
- frustrare că metodele clasice nu se potrivesc.

### Problemele

Spui:

> Problemele sunt combustibil pentru conținut. Aici apar video-urile care opresc scroll-ul, pentru că omul se recunoaște.

Ce urmărești:

- timp puțin;
- oboseală;
- kilograme în plus;
- lipsă de consecvență;
- sentimentul că familia și jobul lasă zero spațiu pentru el.

### Dorințele

Spui:

> Dorințele sunt partea pozitivă. Nu vindem doar „scapă de burtă”. Vindem energie, control, încredere și prezență mai bună pentru familie.

Ce urmărești:

- energie pentru copii;
- corp mai bun fără program extrem;
- rutină realistă;
- încredere;
- sentiment de control.

### Obiecțiile

Spui:

> Obiecțiile sunt aur comercial. Dacă știm de ce nu începe omul, putem face conținut, newsletter și ads care răspund exact la blocaj.

Ce urmărești:

- nu am timp;
- am încercat și nu m-am ținut;
- nu pot merge la sală;
- nu vreau dietă strictă;
- nu cred că merge pentru mine.

### Hook-urile

Spui:

> Hook-urile sunt partea vizibilă. Aici oamenii simt imediat valoarea, dar hook-urile bune vin din research bun, nu din inspirație random.

Exemplu de tip de hook pe care îl cauți:

```text
Dacă ești tată și ai doar 20 de minute pe zi, nu începe cu sala.
```

Explicație:

> Hook-ul vorbește cu un om specific, într-o situație specifică, cu o tensiune specifică.

### Scripturile

Spui:

> Aici vedem cum research-ul devine execuție. Nu avem doar idei. Avem început de video, mesaj, structură și CTA.

Ce urmărești:

- hook clar;
- idee principală;
- structură simplă;
- CTA soft, fără presiune;
- ton potrivit pentru Petru.

### Verificarea umană

Spui:

> Asta e partea pe care mulți o sar. AI-ul nu trebuie lăsat să decidă singur ce e adevărat, ce e sigur și ce se potrivește brandului lui Petru.

Ce trebuie să verifice Petru:

- promisiunile să fie realiste;
- să nu apară sfaturi medicale;
- tonul să fie autentic;
- mesajul să nu fie generic;
- ideile să se potrivească experienței lui reale;
- nimic să nu fie publicat fără aprobare.

## Generalizarea pe orice business

Spui la final:

> Petru e doar sandbox-ul nostru. Dar logica se aplică în orice business.

> Dacă ai cabinet, poți face research pentru întrebările frecvente ale pacienților. Dacă ai agenție, poți face research pentru lead-uri și oferte. Dacă ai e-commerce, poți face research pentru produse, obiecții și campanii. Dacă ești consultant, poți face research pentru nișa clientului.

Cele 4 beneficii:

> Când procesul este clar, economisești timp, reduci bani pierduți pe execuție haotică, eviți angajări premature pentru muncă repetitivă și crești calitatea pentru că ai reguli și verificare.

Formula de închidere:

> Nu întrebăm încă „ce agent wow construim?”. Întrebăm: ce proces se repetă, ce input are, ce output vrem și unde verifică omul?

Hook pentru Ziua 2:

> Mâine luăm acest proces și îl transformăm într-o rețetă reutilizabilă, adică într-un Skill. Apoi începem să-l ducem spre agent specializat.

## Ce nu facem în demo

- Nu promitem rezultate de fitness.
- Nu publicăm automat conținut.
- Nu spunem că AI-ul știe piața perfect.
- Nu intrăm încă în MCP tehnic.
- Nu explicăm Playwright în detaliu.
- Nu construim toată echipa de agenți.

## Posibil teaser wow la final

Spui:

> Astăzi am folosit contextul și brief-ul. În zilele următoare, același proces poate deveni skill reutilizabil, apoi agent specializat, apoi poate folosi browserul pentru research public și poate fi coordonat de un orchestrator.

> Acolo începe partea wow. Dar fundația rămâne aceeași: proces clar, reguli clare, verificare umană.

