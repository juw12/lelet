# Legal read of the letters: request and status

Lelet writes three texts for a home-internet customer: a complaint letter to the provider, a short
WhatsApp version of it, and a second letter to the regulator (Komdigi) when the provider does not answer
in 7 working days. Nobody qualified to give legal advice has read them yet.

**Status on 16 Nov 2026:** the request was sent to YLKI's consumer address by e-mail on 14 Nov at
17:24 WIB, with the review page attached as a PDF. No answer yet. This line is updated when an answer
arrives.

**What changed on 16 Nov, while waiting:** the page was made easier to answer. The three letters are
word for word the ones in the PDF (a test compares them), and the five questions keep their numbers.
Each question now says what the letter does today and offers choices (a), (b), (c), so "1a, 2b, 3b" is a
full answer. The page also says the reader may decline, lists the six places most likely to be wrong,
quotes five related articles the letters do not cite, and says what happens with an answer.
[The page exactly as sent](https://github.com/juw12/lelet/blob/29258011b540f41154738565f2ef9e8592d31444/docs/permohonan-tinjauan.md) stays available.

**Follow-up:** a script on Juwen's PC looks for an answer every hour once it is allowed to read the
inbox, and sends one reminder on Tue 24 Nov 2026 (7 working days after the request) if none has come.
There is no second reminder. On Thu 3 Dec 2026 the request is closed as unanswered and the second
reader below is next.

## The page a reviewer reads

[`docs/permohonan-tinjauan.md`](permohonan-tinjauan.md), in Indonesian. It holds:

- a short summary of what Lelet does and who sends the letters (the customer, never Lelet);
- five questions for the reviewer, each with choices to pick from;
- what was checked and what was not;
- the six places the author thinks are most likely to be wrong;
- the five cited articles of UU 8/1999, quoted word for word, with the source links;
- five related articles the letters do not cite (Article 19 paragraph (3), 23, 45 paragraph (1),
  52 letters a and e), also quoted;
- two telecom service-quality regulations that were found but not read, so the letters do not cite them;
- all three texts, whole, built from sample data;
- how to answer and what happens next: answers by e-mail are not published, no name or organisation
  is mentioned without written permission, and nothing is called "reviewed" without it.

The page is built by `scripts/review-pack.mjs` from `core.js`. `tests/review-pack.test.js` fails when the
page and the app disagree, so a reviewer always reads what the app really writes. After a change to the
letters, run `npm run review-pack`.

## The five questions, in English

Each one first says what the letters do now, then gives the choices.

1. **Right articles.** The letters cite Article 4 letters c, d, h; Article 7 letter g; Article 19
   paragraph (1) of UU 8/1999. For a complaint about internet speed below the plan, is that
   (a) right, (b) should an article be removed, or (c) should one be added?
2. **The word "loss".** The letters lean on Article 19 paragraph (1), which speaks of "consumer loss",
   also for the request for compensation or a bill adjustment. Can speed below the plan (a) be called
   consumer loss, so the citation stays, or (b) should the letters lean only on Article 4 letter h and
   Article 7 letter g?
3. **"Up to".** The letters compare the measurement with the plan speed the customer types in, use the
   subject "not as in the plan", and do not answer the "up to" wording many plans use. (a) Leave it;
   (b) add a sentence that admits "up to" and says the measurements were repeatedly far below it; or
   (c) replace "not as in the plan" with the measured gap only?
4. **7 working days.** The letters ask for an answer "within 7 working days" as the customer's own
   request, not as a legal deadline, and say the complaint will then go to Komdigi, YLKI or BPSK. Is
   that (a) fair and safe for the sender, (b) to be reworded so it does not read as a legal deadline or
   a threat, or (c) better removed?
5. **Other rules and risky sentences**, in two parts that can be answered separately.
   - **5a.** The letters cite only UU 8/1999 and no telecom service-quality regulation. Is (a) the law
     enough, or (b) is there a regulation they should cite (which number)?
   - **5b.** The letters carry the customer's "own estimate" in rupiah, from the author's own formula
     with no legal basis. May it (a) stay, (b) should it go, or (c) is another sentence risky for the
     sender (which)?

## What was checked, and by whom

An AI assistant compared each cited article with the text of the law on 14 Nov 2026: 5 of 5 exist and
none is misquoted. It also read the status of the law on the audit board's legal database: "Berlaku"
(in force). The same page lists Constitutional Court ruling 235/PUU-XXIII/2025 on Article 31; the letters
do not cite Article 31, and the ruling itself was not read.

- Law text read: https://jdih.kemenkeu.go.id/api/download/FullText/1999/8TAHUN~1999UU.htm
- Status page: https://peraturan.bpk.go.id/Details/45288/uu-no-8-tahun-1999

On 16 Nov 2026 the same assistant read both pages again. The status is still "Berlaku". The five related
articles now quoted on the review page were each found word for word in the law text. The audit board's
records for the two telecom regulations were opened only for their status (both changed by later rules);
their texts are still unread, so the letters still do not cite them.

An earlier version of this page linked a different record on the audit board's site by mistake. The
quotes were always taken from the law text above, so the 5-of-5 result did not change; the link is fixed.

That is a reading check, not a legal review. Questions 1 to 5 need a person who is allowed to give legal
advice. Until an answer is in, the app keeps its "not legal advice" line and the letters stay as they are.

## Who can review it

1. **YLKI** (Yayasan Lembaga Konsumen Indonesia), the consumer foundation: https://ylki.or.id/kontak/
2. **BPKN**, the national consumer protection agency, through its own portal: https://pengaduan.bpkn.go.id
   (asks for the sender's identity, so it is Juwen's step).
3. A university legal-aid clinic or a paid consultation with a consumer-law lawyer (Juwen's step).
