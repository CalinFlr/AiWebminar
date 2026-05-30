# Ziua 1 - Formular tema Workflow Brief v1

> Status: v1 de lucru.
> Scop: specificație pentru formularul/onboardingul trimis după Ziua 1.

## Rolul formularului

Formularul transformă tema de final într-un material util pentru Ziua 2, recap, hot seats și VIP Lab.

Nu vrem răspunsuri de tip:

- „vreau să automatizez marketingul”;
- „vreau un agent pentru business”;
- „vreau să fac totul cu AI”.

Vrem răspunsuri specifice:

- un proces repetitiv;
- un input clar;
- pași actuali;
- output dorit;
- reguli și limite;
- verificare umană;
- miză de business.

## Mesaj de introdus deasupra formularului

```text
Completează Workflow Brief v1 pentru un proces real din businessul tău.

Nu alege cel mai spectaculos proces. Alege unul care se repetă, consumă timp, produce erori, pierde bani sau afectează calitatea.

În Ziua 2 luăm această structură și o transformăm într-un Skill, adică o rețetă reutilizabilă pentru AI.
```

## Câmpuri recomandate

| Câmp | Tip | Obligatoriu | Întrebare afișată |
|---|---|---:|---|
| `business_context` | textarea | Da | Ce business/rol/context ai? Scrie pe scurt domeniul și ce faci. |
| `chosen_process` | textarea | Da | Ce proces repetitiv alegi pentru primul workflow AI? |
| `process_input` | textarea | Da | Ce informații intră la început în acest proces? |
| `current_steps` | textarea | Da | Cum faci acum procesul manual, pas cu pas? |
| `desired_output` | textarea | Da | Ce rezultat concret vrei să producă workflow-ul? |
| `rules_limits` | textarea | Da | Ce reguli și limite trebuie respectate? Ce nu are voie să facă AI-ul? |
| `human_review` | textarea | Da | Unde trebuie să verifici tu sau cineva din echipă înainte ca rezultatul să fie folosit? |
| `business_stake` | checkbox | Da | Care este miza principală? |
| `weekly_time_cost` | select | Nu | Cât timp consumă procesul acum pe săptămână? |
| `example_material` | textarea | Nu | Ai un exemplu concret, link public sau notițe care pot ajuta? Nu trimite date sensibile. |
| `vip_hotseat_permission` | checkbox | Nu | Pot folosi răspunsul tău anonimizat ca exemplu în recap sau VIP Lab? |

## Opțiuni pentru miza principală

Participantul poate alege una sau mai multe:

- timp economisit;
- bani economisiți;
- lead-uri sau oportunități mai bine capturate;
- mai puțină muncă repetitivă;
- evitarea unei angajări premature;
- calitate mai constantă;
- mai puține erori;
- claritate operațională.

## Opțiuni pentru timp consumat

- sub 1 oră/săptămână;
- 1-2 ore/săptămână;
- 2-5 ore/săptămână;
- 5-10 ore/săptămână;
- peste 10 ore/săptămână;
- nu știu încă.

## Texte de ajutor sub câmpuri

### Business/context

```text
Ex: cabinet local, agenție marketing, consultant B2B, e-commerce, trainer, coach, firmă servicii, rol într-o companie.
```

### Proces ales

```text
Bun: follow-up pentru lead-uri pe WhatsApp.
Prea vag: marketing.
```

### Input

```text
Ex: mesajul clientului, formularul completat, link public, notițe interne, lista de produse, întrebări frecvente.
```

### Pași actuali

```text
Scrie cum faci acum procesul manual. Nu trebuie să fie perfect. Important este să vedem ordinea.
```

### Output dorit

```text
Ex: răspuns propus, sumar, listă de priorități, hook-uri, email draft, raport, reminder, checklist.
```

### Reguli și limite

```text
Ex: nu trimite mesaj fără aprobare, nu promite rezultate, nu folosi date sensibile, nu decide prețuri singur.
```

### Verificare umană

```text
Ex: eu aprob mesajul final, asistenta verifică programarea, managerul aprobă raportul, ownerul validează oferta.
```

## Validare calitativă

Un răspuns bun trebuie să treacă 4 teste:

1. **Specific:** se referă la un proces, nu la o zonă largă.
2. **Repetitiv:** apare suficient de des ca să merite lucrat.
3. **Verificabil:** are un output care poate fi evaluat.
4. **Controlabil:** există un punct clar unde verifică omul.

## Exemple bune

### Exemplu 1 - Business local

**Proces:** răspunsuri la întrebări repetitive despre programări.

**Input:** mesajul clientului, lista serviciilor, programul disponibil, regulile cabinetului.

**Output:** răspuns propus + etichetare întrebare + pas următor.

**Verificare:** recepția verifică înainte de trimitere.

**Miză:** timp economisit, mai puține programări pierdute, răspunsuri mai constante.

### Exemplu 2 - Consultant

**Proces:** pregătirea unui sumar după un call de discovery.

**Input:** notițe din call, obiectivul clientului, probleme, buget aproximativ.

**Output:** sumar, oportunități, riscuri, pași următori, draft de ofertă.

**Verificare:** consultantul aprobă sumarul și oferta.

**Miză:** calitate, timp economisit, follow-up mai rapid.

### Exemplu 3 - Petru / fitness

**Proces:** research și direcție de conținut pentru `fit dads`.

**Input:** nișa, obiectivul, canalele, limitele de comunicare.

**Output:** avatar, probleme, obiecții, hook-uri, scripturi.

**Verificare:** Petru aprobă direcția înainte de publicare.

**Miză:** conținut mai relevant, bază pentru newsletter și ads.

## Exemple de răspunsuri de corectat

| Răspuns vag | Cum îl împingem spre claritate |
|---|---|
| Vreau să automatizez marketingul | Care este primul proces repetitiv din marketing: research, captions, newsletter, ads, raportare? |
| Vreau un agent pentru business | Ce task exact vrei să pregătească agentul prima dată? |
| Vreau să postez mai mult | Din ce input pornesc postările și ce output vrei: captions, hook-uri, calendar sau scripturi? |
| Vreau să reduc munca manuală | Ce muncă manuală se repetă săptămânal și cine o face acum? |

## Mesaj de confirmare după trimitere

```text
Am primit Workflow Brief-ul tău v1.

În Ziua 2 îl folosim ca punct de plecare: procesul devine o rețetă reutilizabilă, adică un Skill, apoi îl ducem spre agent specializat.

Dacă ai ales un proces prea larg, îl vom rafina: scopul este să găsim prima piesă clară, nu să automatizăm tot businessul dintr-o dată.
```

## Cum folosim răspunsurile

Răspunsurile pot fi folosite pentru:

- recap în Ziua 2;
- exemple anonimizate;
- identificarea celor mai comune procese;
- hot seats VIP;
- roadmap VIP pe 7 zile;
- segmentarea viitoarelor materiale pe owner, profesionist și consultant.

## Guardrails

- Nu cerem date sensibile.
- Nu cerem date medicale, financiare sau personale despre clienți.
- Nu cerem parole, acces la conturi sau fișiere confidențiale.
- Dacă participantul dă un exemplu real, îl folosim doar anonimizat.
- Pentru cabinet/clinică, lucrăm doar cu procese operaționale, nu cu decizii medicale.

## Mesaj WhatsApp/email pentru tema de final

```text
Tema Zilei 1:

Completează Workflow Brief v1 pentru un proces real din businessul tău.

Alege ceva specific: un proces care se repetă, consumă timp, produce erori, pierde bani sau afectează calitatea.

Mâine îl transformăm într-un Skill, adică o rețetă reutilizabilă pentru AI.

Formular: {workflow_brief_form_link}
```

