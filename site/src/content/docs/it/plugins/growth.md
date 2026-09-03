---
title: foundry-growth
description: Tutto ciò che sta attorno al progetto invece che dentro — posizionamento, lancio, pubblico, narrativa per i finanziatori, reputazione personale e ricerca di collaboratori nel proprio settore.
sidebar:
  order: 7.5
---

Costruire la cosa è la parte che Foundry copriva già. `foundry-growth` copre il resto: decidere per
chi è il progetto e che cosa afferma, lanciarlo senza fingere, tenere un pubblico, chiedere denaro
al tipo giusto di finanziatore, essere trovabile dalle persone che contano e trovare quelle con cui
lavorare.

È il verticale con la tentazione più forte di inventare, quindi è quello tenuto più stretto.
Nessun agente qui può asserire le regole correnti di una piattaforma, una soglia di follower, il
taglio di assegno di un fondo, la scadenza di un accelleratore, un benchmark di conversione o il
«momento migliore per pubblicare»: sono tutte cose che scadono e nessuna è verificabile dal tuo
repository. Ogni fatto del genere viene recuperato a runtime dalla sua fonte e marcato con la data
del controllo, oppure non compare.

## Installazione

```bash
/plugin install foundry-growth@foundry
```

Richiede `foundry-core`, installato automaticamente come dipendenza.

## Quando installarlo

- Il progetto funziona e nessuno sa che esiste.
- La descrizione che ne dai potrebbe descrivere altri tre progetti, e due persone del team non
  rispondono allo stesso modo alla domanda «per chi è».
- Si sta discutendo una data di lancio e nessuno ha messo per iscritto che cosa conterebbe come
  «è andata bene».
- Stai per avvicinare un finanziatore, o è aperto un bando, e la presentazione non è mai stata
  messa alla prova da qualcuno disposto a dire di no.
- Il tuo lavoro migliore è invisibile, coperto da NDA o dentro un repository privato — e devi
  risultare credibile lo stesso.
- Il progetto è diventato troppo grande per una persona sola.

## Quando non usarlo

- Non scrive il tuo modello finanziario. Proiezioni, unit economics, break-even, VAN/TIR e TCO
  appartengono a `foundry-economics`. Growth scrive l'argomento; economics scrive i numeri.
- Non fa l'amministrazione dei bandi — moduli di ammissibilità, tabelle di budget, timesheet,
  rendicontazione dei milestone. Quello è `foundry-economics:funding-analyst`. Growth si occupa del
  targeting e della narrativa.
- Non gestisce il funnel dei contributori dentro un repository open source, non scrive CONTRIBUTING
  e non fa triage delle issue. Quello è `foundry-oss`. Growth porta le persone al progetto;
  `foundry-oss` governa ciò che accade una volta arrivate.
- Non dà consulenza legale. Consenso al marketing, GDPR per una lista di contatti, diritto della
  pubblicità, disclosure delle sponsorizzazioni, contratti e cessione di proprietà intellettuale
  vanno tutti a `foundry-legal`.
- Non ti aiuterà a fingere nulla. Testimonianze inventate, loghi di chi non è un utente, conteggi
  di utenti mai contati, scarsità fabbricata e liste di contatti raschiate sono rifiutati per nome,
  non riscritti in una forma più presentabile.

## Agenti

| Agente | Cosa fa | Modello | Sforzo |
|---|---|---|---|
| `positioning-strategist` | Stabilisce per chi è il progetto e che cosa afferma, prima che una qualsiasi copy, landing page, lancio o pitch ne erediti la risposta. Alternative reali valutate incluso il non fare nulla e il farlo a mano, non-obiettivi espliciti, un nome verificato contro i registri vivi e non a memoria, e una passata finale che riconduce ogni parola di superiorità a un artefatto di prova, o la taglia. | `sonnet` | `medium` |
| `launch-strategist` | Gate di prontezza che devono passare prima che una data possa esistere, canali scelti da dove il pubblico già sta con le regole correnti di ciascuno recuperate al momento del lancio, successo definito in numeri concordati prima, il protocollo delle prime ore, e una lettura onesta di un lancio andato a vuoto: canale sbagliato, posizionamento sbagliato e assenza di domanda sono tre correzioni diverse. | `sonnet` | `medium` |
| `audience-builder` | Attenzione sostenuta invece di un picco di un giorno: un backlog editoriale estratto da lavoro già avvenuto, una cadenza dimensionata sulle ore che hai davvero, metriche che dichiarano a quale domanda ciascuna può e non può rispondere, e gli asset che continuano a rendere dopo che il post è scorso via. | `sonnet` | `medium` |
| `fundraising-strategist` | Parte dal se tu debba raccogliere denaro, e da chi. I tipi di finanziamento e ciò che ciascuno pretende davvero, la prontezza valutata come prove che esistono e non come racconto, la presentazione come argomento e non come template, la data room, la sequenza di contatto, e le prove generali delle domande che ti faranno — inclusa «perché finora non ha funzionato». | `opus` | `high` |
| `personal-brand-strategist` | Per chi trova l'autopromozione sgradevole: descrivere accuratamente il lavoro reale è documentazione, non promozione. Un audit riproducibile di ciò che uno sconosciuto trova oggi, il portfolio come prova verificabile, la scrittura pubblica e le CFP, e la passata di verifica in cui tutto ciò che un lettore non può controllare viene tagliato. | `sonnet` | `medium` |
| `collaborator-scout` | Nomina la lacuna e ciò che offri in cambio prima di avvicinare chiunque. Candidati ricavati da artefatti pubblici invece che da un elenco di piattaforme, contatto che si guadagna una risposta, la conversazione sulla compatibilità comprese le domande scomode, una prova circoscritta con una fine definita, e i termini — proprietà, credito, diritti di decisione, uscita — stabiliti prima che il lavoro cominci. | `sonnet` | `medium` |

## Skill

| Skill | Quando scatta |
|---|---|
| `position-project` | Prima che vengano scritte una landing page, un lancio o un pitch; quando la descrizione attuale potrebbe descrivere altri tre progetti; quando nessuno dà la stessa risposta a «per chi è». Legge prima il repository per trovare che cosa il progetto fa davvero rispetto a ciò che il suo autore dice che faccia. Produce `docs/growth/positioning.md`. |
| `plan-launch` | Quando si discute una data di lancio, o quando un lancio precedente è andato a vuoto. Esegue per primo un gate di prontezza eseguibile contro il repository, ed è disposto a concludere «non pronto, rimanda». Produce `docs/growth/launch-plan.md` e un `plan.v1`. |
| `build-audience` | Quando il progetto è stato rilasciato ma nessuno sa che esiste, o quando la pubblicazione è stata sporadica. Estrae dal repository il materiale che già esiste e dimensiona la cadenza su un numero dichiarato di ore a settimana. Produce `docs/growth/audience-plan.md`. |
| `prepare-fundraise` | Prima di avvicinare qualsiasi finanziatore, quando si sta valutando un bando, o quando una presentazione non è mai stata messa alla prova. Comincia da «ti conviene raccogliere?» e può rispondere di no. Produce `docs/growth/fundraising/` con valutazione di prontezza, narrativa, struttura della presentazione, indice delle prove e checklist della data room. |
| `audit-personal-brand` | Prima di una ricerca di lavoro, di un round, di una proposta per una conferenza o di un approccio di collaborazione; quando ciò che uno sconosciuto trova non corrisponde a ciò che sai davvero fare. Produce `docs/growth/personal-brand.md` con un insieme piccolo e prioritizzato di azioni, non quaranta compiti. |
| `find-collaborators` | Quando il progetto è diventato troppo grande per una persona sola, quando manca una competenza, o quando una collaborazione precedente è finita male. Produce `docs/growth/collaborators.md`. |

## Contratti di output

| Agente | Input | Output |
|---|---|---|
| `positioning-strategist` | `requirement.v1` | `adr.v1` |
| `launch-strategist` | `adr.v1` | `plan.v1` |
| `audience-builder` | `plan.v1` | `plan.v1` |
| `fundraising-strategist` | `requirement.v1` | `review.v1` |
| `personal-brand-strategist` | `requirement.v1` | `review.v1` |
| `collaborator-scout` | `requirement.v1` | `plan.v1` |

Il posizionamento è un `adr.v1` perché è una decisione con alternative e conseguenze, e perché
tutto ciò che sta a valle lo eredita: il lancio lo legge, il pitch lo cita, il contatto ci si
appoggia. Riaprire un posizionamento sostituisce l'ADR precedente invece di modificarlo.

## Il gate sulle affermazioni

È l'unico verticale che porta un hook proprio. `guard-claims.mjs` gira su `PreToolUse` per `Write`
ed `Edit`, e chiede conferma — non blocca mai — quando la copy destinata all'esterno contiene un
rischio di insostenibilità: una percentuale, un moltiplicatore, una cifra in denaro o un conteggio
di utenti senza una fonte accanto; un superlativo non qualificato; credibilità presa in prestito
(`trusted by`, `as seen in`, un blocco di testimonianze); urgenza fabbricata; o una previsione
scritta con la grammatica di un fatto. Il motivo cita i frammenti esatti e dice che cosa renderebbe
pubblicabile ciascuno.

Legge solo prosa sotto un percorso destinato all'esterno — `growth/`, `marketing/`, `launch/`,
`pitch/`, `press/`, `fundraising/` e simili — quindi codice, test e documentazione non lo attivano
mai. Resta silenzioso finché `foundry init` non è stato eseguito, rispetta `enforcement: "off"` e
`{"growth": {"claimGuard": false}}`, e può essere sospeso da un override in
`.foundry/overrides.json` che porti una scadenza. Un override senza scadenza viene ignorato, per la
stessa regola del kernel che governa ogni gate di Foundry.

È un filo teso lessicale, non un verificatore di fatti: non sa distinguere un «40% più veloce» vero
da uno falso, solo che accanto non c'è nulla che dica da dove venga il numero. Un'esecuzione
silenziosa significa «niente di evidente», mai «sostanziato».

## Limiti

- I risultati di ricerca sono personalizzati e variabili nel tempo. Un conteggio di affollamento
  registrato è un'osservazione datata, non una misura che una seconda esecuzione riproduce.
- Stimare quanto in fretta un concorrente potrebbe copiare una funzionalità è lavoro dentro il
  codice di qualcun altro. Questi agenti obbligano a dichiarare l'assunzione, il che la rende
  onesta senza renderla accurata.
- Il gate è lessicale. Segnalerà un documento di posizionamento che cita «trusted by 10.000
  sviluppatori» come esempio di ciò che non va scritto. È il compromesso corretto per un matcher
  senza parser: approva e prosegui.
- Niente di tutto questo rende un progetto degno di attenzione. Se il collo di bottiglia non è il
  pubblico, l'`audience-builder` ha istruzione di dirlo e fermarsi.
