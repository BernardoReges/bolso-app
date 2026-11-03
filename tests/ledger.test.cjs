const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../src/ledger.cjs");
const form = (type, amount, more = {}) => ({
  type,
  amount,
  date: L.today().split("-").reverse().join("/"),
  account: "conta",
  category: "Outros",
  ...more,
});
test("Valores em reais são convertidos para centavos inteiros sem arredondamento silencioso", () => {
  assert.equal(L.parseAmount("0,10"), 10);
  assert.equal(L.parseAmount("1.234,56"), 123456);
  assert.equal(L.parseAmount("25"), 2500);
  for (const v of [
    "0",
    "-2",
    "1,999",
    "NaN",
    "2.50",
    "1e3",
    "1,2,3",
    "999999999999999",
  ])
    assert.throws(() => L.parseAmount(v));
});
test("Transferência conserva o total e não infla receitas ou despesas", () => {
  let d = L.saveTransaction(L.empty(), form("income", "1000"));
  d = L.saveTransaction(d, form("expense", "125,90"));
  d = L.saveTransaction(d, form("transfer", "200", { to: "carteira" }));
  const r = L.summary(d, L.today().slice(0, 7));
  assert.equal(r.total, 87410);
  assert.equal(r.balances.conta, 67410);
  assert.equal(r.balances.carteira, 20000);
  assert.equal(r.income, 100000);
  assert.equal(r.expense, 12590);
  assert.equal(r.net, 87410);
  assert.throws(() =>
    L.saveTransaction(d, form("transfer", "10", { to: "conta" })),
  );
});
test("Editar mantém identidade, não duplica e recalcula os saldos; excluir remove o efeito", () => {
  let d = L.saveTransaction(L.empty(), form("expense", "10"));
  const id = d.transactions[0].id;
  d = L.saveTransaction(d, form("expense", "20", { account: "carteira" }), id);
  assert.equal(d.transactions.length, 1);
  assert.equal(d.transactions[0].id, id);
  assert.equal(L.summary(d, L.today().slice(0, 7)).balances.conta, 0);
  assert.equal(L.summary(d, L.today().slice(0, 7)).balances.carteira, -2000);
  d = { ...d, transactions: [] };
  assert.equal(L.summary(d, L.today().slice(0, 7)).total, 0);
});
test("Resumo mensal não inclui outro mês; saldo total inclui histórico e saldo inicial", () => {
  let d = L.empty();
  d.accounts[0].opening = 10000;
  d = L.saveTransaction(d, form("income", "100", { date: "01/01/2020" }));
  const r = L.summary(d, "2020-02");
  assert.equal(r.income, 0);
  assert.equal(r.total, 20000);
});
test("Backup válido tem round trip; IDs duplicados, referências inexistentes e campos inválidos são rejeitados", () => {
  const d = L.saveTransaction(L.empty(), form("income", "5"));
  assert.deepEqual(L.validate(JSON.parse(JSON.stringify(d))), d);
  for (const mutate of [
    (x) => (x.version = 99),
    (x) => x.accounts.push(x.accounts[0]),
    (x) => x.transactions.push(x.transactions[0]),
    (x) => (x.transactions[0].account = "ausente"),
    (x) => (x.transactions[0].amount = 1.1),
    (x) => (x.transactions[0].date = "2026-02-30"),
    (x) => (x.transactions[0].note = "x".repeat(121)),
  ]) {
    const x = structuredClone(d);
    mutate(x);
    assert.throws(() => L.validate(x));
  }
});
test("Datas impossíveis e futuras não viram movimentações realizadas", () => {
  for (const date of ["30/02/2026", "2026-01-01", "01/01/2099"])
    assert.throws(() =>
      L.saveTransaction(L.empty(), form("expense", "10", { date })),
    );
});
