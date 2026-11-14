# Legal read of the letters: request and status

Lelet writes three texts for a home-internet customer: a complaint letter to the provider, a short
WhatsApp version of it, and a second letter to the regulator (Komdigi) when the provider does not answer
in 7 working days. Nobody qualified to give legal advice has read them yet.

**Status on 14 Nov 2026:** the request was sent to YLKI's consumer address by e-mail at 17:24 WIB, with
the review page attached as a PDF. No answer yet. This line is updated when an answer arrives.

## The page a reviewer reads

[`docs/permohonan-tinjauan.md`](permohonan-tinjauan.md), in Indonesian. It holds:

- a short summary of what Lelet does and who sends the letters (the customer, never Lelet);
- five questions for the reviewer;
- what was checked and what was not;
- the five cited articles of UU 8/1999, quoted word for word, with the source links;
- two telecom service-quality regulations that were found but not read, so the letters do not cite them;
- all three texts, whole, built from sample data.

The page is built by `scripts/review-pack.mjs` from `core.js`. `tests/review-pack.test.js` fails when the
page and the app disagree, so a reviewer always reads what the app really writes. After a change to the
letters, run `npm run review-pack`.

## The five questions, in English

1. Do the cited articles of UU 8/1999 (Article 4 letters c, d, h; Article 7 letter g; Article 19
   paragraph (1)) fit a complaint about internet speed below the plan?
2. Can speed below the plan be called "consumer loss" under Article 19 paragraph (1), or should the
   letters lean only on Article 4 letter h and Article 7 letter g?
3. Most plans say "up to" a speed. The letters compare the measurement with the plan speed the customer
   types in and do not answer "up to". Should they, and how?
4. The letters ask for an answer "within 7 working days" as the customer's own request, not as a legal
   deadline, and say the complaint will then go to Komdigi, YLKI or BPSK. Is that wording fair and safe
   for the sender?
5. Is there a telecom service-quality regulation the letters should cite? Is any other sentence risky
   for the sender, including the customer's own rupiah estimate?

## What was checked, and by whom

An AI assistant compared each cited article with the text of the law on 14 Nov 2026: 5 of 5 exist and
none is misquoted. It also read the status of the law on the audit board's legal database: "Berlaku"
(in force). The same page lists Constitutional Court ruling 235/PUU-XXIII/2025 on Article 31; the letters
do not cite Article 31, and the ruling itself was not read.

- Law text read: https://jdih.kemenkeu.go.id/api/download/FullText/1999/8TAHUN~1999UU.htm
- Status page: https://peraturan.bpk.go.id/Details/45288/uu-no-8-tahun-1999

An earlier version of this page linked a different record on the audit board's site by mistake. The
quotes were always taken from the law text above, so the 5-of-5 result did not change; the link is fixed.

That is a reading check, not a legal review. Questions 1 to 5 need a person who is allowed to give legal
advice. Until an answer is in, the app keeps its "not legal advice" line and the letters stay as they are.

## Who can review it

1. **YLKI** (Yayasan Lembaga Konsumen Indonesia), the consumer foundation: https://ylki.or.id/kontak/
2. **BPKN**, the national consumer protection agency, through its own portal: https://pengaduan.bpkn.go.id
   (asks for the sender's identity, so it is Juwen's step).
3. A university legal-aid clinic or a paid consultation with a consumer-law lawyer (Juwen's step).
