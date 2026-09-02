# 00 · State

The tutor's memory. Frau Ritter reads all three of these files **before** every
lesson, drill or exam, and writes to them after. A session that does not update
them did not happen.

| File | What it holds | Written by |
|---|---|---|
| `profil.md` | Who I am: level, goal, exam date, hours per week, weaknesses | me + `/exam`, `/fehler` |
| `fortschritt.md` | Module status, scores, hours, session log | every command |
| `fehlerlog.md` | **Every mistake I have ever made**, tagged | every correction |

## None of these are in the repo

They are listed in [`.gitignore`](../.gitignore) and they stay on your machine.
`profil.md` in particular can hold residence status, employer and language
background — it must never be published. The repo ships blank versions in
[`templates/`](../templates/); `./setup.sh` copies them here.

If you move or rename any of them, update `.gitignore` in the same commit.

## `fehlerlog.md` is the engine

Everything else in the vault is downstream of it. Each correction appends a tagged
row:

```
| 2026-09-02 | #kasus/dativ | "mit meine Freund" | "mit meinem Freund" | Dativ nach *mit* | L-012 |
```

The tags come from a **closed** taxonomy defined in [`CLAUDE.md`](../CLAUDE.md), so
mistakes can be *counted*. Those counts decide the next lesson's content, generate
`/drill` exercises, and gate module completion — a module is not finished while its
signature error is still in the top five.

Keep the taxonomy closed. Free-form tags cannot be counted, and the moment they
cannot be counted the whole system stops working.

## One warning

The tutor is only as honest as these files. Skip logging an embarrassing mistake, or
mark a module complete because you are bored of it, and the next three weeks get
built on a false picture — with no way for it to know. Its one advantage over an app
is that it remembers exactly what you get wrong.
