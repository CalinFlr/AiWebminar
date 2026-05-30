# Scan pagini AI Wizard - landing pages workshop

Data scanare: 2026-05-11

## Concluzie scurta

Am gasit confirmate public doua landing pages active sub `https://ai-wizard.pro/lp/ws/`:

1. `automatizari-ai`
2. `multi-agenti`

Nu pare ca are o pagina separata pentru fiecare sesiune individuala. Mai probabil are cate o pagina separata pentru fiecare workshop/campanie/oferta, iar sesiunile sunt descrise in interiorul aceleiasi pagini.

## Metoda folosita

- verificat `robots.txt`;
- verificat `sitemap.xml` si `sitemap_index.xml`;
- verificat `/lp/ws/`;
- extras linkuri din paginile deja cunoscute;
- verificat site-ul principal `ai-wizard.tech`;
- cautat in urlscan.io;
- cautat in Common Crawl pentru `ai-wizard.pro/lp/ws/*`;
- verificare controlata pe slug-uri probabile de workshop.

## Limitari

- `sitemap.xml` si `sitemap_index.xml` returneaza 404.
- `/lp/ws/` returneaza 404.
- `ai-wizard.pro/` returneaza 403.
- Google/DuckDuckGo au returnat challenge, deci nu am putut folosi search engine scraping direct.
- Common Crawl nu are capturi pentru `ai-wizard.pro/lp/ws/*`.
- Scanarea pe slug-uri probabile nu poate garanta ca nu exista pagini cu slug-uri complet neintuitive sau neindexate.

## Pagini confirmate

| URL | Tema | Promisiune principala | Oferta |
|---|---|---|---|
| `https://ai-wizard.pro/lp/ws/automatizari-ai/` | Automatizari AI / agenti AI | In 3 zile ai agenti AI care lucreaza pentru tine 24/7 | Gratuit + VIP 19 EUR |
| `https://ai-wizard.pro/lp/ws/multi-agenti/` | Sisteme multi-agenti AI | Construiesti primul sistem multi-agenti AI in 3 zile, fara cod | Gratuit + VIP 19 EUR |

## Pagina 1: `automatizari-ai`

### Positionare

Workshop 3+1 zile despre agenti AI autonomi care fac research, analiza, continut si automatizari.

### Elemente cheie

- Hero: "In 3 zile vei avea Agenti AI care lucreaza pentru tine 24/7".
- Autoritate: "cu un ex-inginer Google".
- Durere: businessul merge doar cand esti tu acolo.
- Framework: 4 niveluri de utilizare AI:
  - Chat;
  - Agent;
  - Agent + Skills;
  - Echipa de agenti.
- Program:
  - Ziua 1: primul agent AI;
  - Ziua 2: agent specialist + skills;
  - Ziua 3: echipa de agenti / SaaS de la zero;
  - Ziua VIP: OpenClaw.
- Bonus: ghid PDF "12 sarcini repetitive pe care un agent AI le poate prelua maine".
- Pricing: 0 EUR / 19 EUR VIP.
- CTA-uri:
  - `https://ai-wizard.tech/automatizariai_reg`
  - `https://ai-wizard.tech/automatizariai_reg_vip`

### Observatie

Aceasta pagina vorbeste mai ales cu owneri/soloprenori si oameni care simt ca pierd timp pe munca manuala. Persona de profesionist la job este acoperita slab.

## Pagina 2: `multi-agenti`

### Positionare

Workshop 3 zile despre echipe de agenti AI care comunica intre ei si executa procese complexe.

### Elemente cheie

- Hero: "Construieste primul tau Sistem Multi-Agenti AI in 3 zile".
- Promisiune: echipe de agenti AI care comunica intre ei si executa procese complexe singure.
- Durere: folosesti AI, dar tot tu faci munca.
- Durere secundara: ce ai incercat e prea tehnic.
- Competitie: competitorii au deja sisteme de agenti care lucreaza fara ei.
- Program:
  - de la ChatGPT la primul agent AI;
  - multi-agenti in actiune: funnel de marketing de la zero;
  - Agent Team cu skills;
  - VIP: OpenClaw.
- Bonus: "Audit AI pentru Business-ul Tau + 10 Sisteme Multi-Agenti".
- Public tinta declarat:
  - fondatori si soloprenori;
  - proprietari de agentii;
  - manageri de operatiuni;
  - profesionisti si freelanceri.
- Pricing: 0 EUR / 19 EUR VIP.
- CTA-uri:
  - `https://ai-wizard.tech/sisteme_multi_agenti_reg`
  - `https://ai-wizard.tech/sisteme_multi_agenti_reg_vip`

### Observatie

Aceasta pagina este un pas mai avansat decat `automatizari-ai`. Nu mai vinde doar "agenti AI", ci "sisteme multi-agent". Pare construita pentru un public care a auzit deja de agenti si vrea urmatorul nivel.

## Pattern observat

AI Wizard foloseste aceeasi arhitectura de funnel, dar schimba unghiul:

| Componenta | Automatizari AI | Multi-agenti |
|---|---|---|
| Promisiune | Agenti AI 24/7 | Sisteme multi-agent |
| Nivel de sofisticare | Entry/mid | Mid/advanced |
| Durere | Munca manuala si business dependent de tine | Folosesti AI, dar tot tu coordonezi totul |
| Demo wow | Agent, landing page, SaaS | Funnel marketing, agent team, aplicatie completa |
| Bonus | 12 sarcini repetitive | Audit AI + 10 sisteme multi-agent |
| Oferta | 0 EUR + VIP 19 EUR | 0 EUR + VIP 19 EUR |

## Interpretare strategica

Nu pare ca au cate o pagina pentru fiecare sesiune. Au cate o pagina pentru fiecare tema de workshop/campanie:

- pagina pentru automatizari/agenti AI;
- pagina pentru sisteme multi-agent;
- probabil ar putea avea si alte pagini daca lanseaza alte unghiuri de campanie, dar nu le-am gasit public in scanarea curenta.

## Ce invatam pentru landingul nostru

### 1. Trebuie sa avem o pagina umbrela, dar pregatita pentru variante

Landingul nostru principal poate ramane:

**AI Automation Zero to Hero**

Dar ar trebui sa putem crea usor variante:

- Business owners: AI pentru procese, timp, costuri, echipa.
- Profesionisti: AI Power User la job.
- Consultanti/freelanceri: AI Automation Consultant.
- Avansat: agenti AI si sisteme AI.

### 2. Nu trebuie sa copiem "multi-agent" ca mesaj principal

Pentru publicul nostru, "multi-agent" poate suna prea avansat. Este bun ca demo wow sau modul avansat, dar mesajul principal ramane:

**De la ChatGPT la workflow-uri si sisteme AI practice.**

### 3. Putem folosi acelasi pattern de oferta

Modelul 0 EUR + 19 EUR VIP/Implementation Lab apare pe ambele pagini. Este probabil testat.

Pentru noi:

- Workshop live gratuit;
- Implementation Lab 19 EUR;
- pitch catre programul premium.

### 4. Diferentierea noastra trebuie sa fie mai clara

Competitorul vinde:

- ex-Google;
- agenti 24/7;
- business pe autopilot;
- demo-uri wow.

Noi putem vinde:

- 15+ ani in IT si sisteme enterprise;
- procese reale reduse de la ore/zile la minute;
- metoda clara pentru oameni non-tehnici;
- trei trasee pe personas: afacere, job, clienti;
- implementare controlabila, nu hype.

## Recomandare pentru urmatorul pas

Sa tratam landingul nostru ca template modular:

1. Hero general.
2. Sectiune personas/trasee.
3. Program workshop.
4. Sectiune autoritate Calin.
5. Pricing 0/19.
6. Formular segmentat.

Apoi putem crea rapid variante de headline si ad angle fara sa rescriem toata pagina:

- `owner`: "AI pentru procesele repetitive din businessul tau".
- `job`: "Devino AI Power User in rolul tau".
- `consultant`: "Invata sa construiesti automatizari AI pentru clienti".
- `advanced`: "De la workflow-uri la agenti AI".
