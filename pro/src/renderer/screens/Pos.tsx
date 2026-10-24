import { useCallback, useEffect, useState } from "react";
import type {
  AuthSession,
  CartLine,
  CatalogEntry,
  Customer,
  ExpiryItem,
  InventoryException,
  SaleHistoryRow,
  SaleResult,
  SyncStatus,
} from "../../shared/types";
import packageInfo from "../../../package.json";
import { makeT, type Lang } from "../i18n";
import { Finance } from "./Finance";
import { Staff } from "./Staff";

interface CartRow extends CartLine {
  canonical_name: string;
}

type PaymentMethod = "cash" | "bank" | "later";
type PayStatus = "paid" | "partial" | "unpaid";
function creditDueDate(): string {
  const value = new Date(); value.setDate(value.getDate() + 30);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}
function formatSdg(amount: number): string {
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SDG`;
}

function friendly(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const m = raw.trim();
  if (/invalid login|invalid authentication|invalid credentials/i.test(m))
    return "Incorrect email or password.";
  if (/weak.?password/i.test(m)) return "That password is too weak.";
  if (/already registered|already exists|user_already/i.test(m))
    return "An account with this email already exists.";
  if (/failed to fetch|networkerror|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|net::ERR/i.test(m))
    return "Can't reach the server. Check your connection and try again.";
  if (/only an admin/i.test(m)) return "Only an admin can do that.";
  if (/[{}]/.test(m) || /\bat\s+/i.test(m) || /error_code|status.?code/i.test(m))
    return "Something went wrong. Please try again.";
  if (m.length > 140) return "Something went wrong. Please try again.";
  return m;
}

export function Pos({
  session,
  onSignOut,
  lang,
  setLang,
  theme,
  setTheme,
}: {
  session: AuthSession;
  onSignOut: () => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
}) {
  const t = makeT(lang);
  const canManageTeam = session.membership_role === "owner";
  const isAdmin = session.role === "admin" || canManageTeam;

  const [tab, setTab] = useState<
    "sell" | "stock" | "sales" | "finance" | "expiry" | "staff" | "accounts" | "settings"
  >("sell");
  const [query, setQuery] = useState("");
  const [saleSearchOpen, setSaleSearchOpen] = useState(false);
  const [products, setProducts] = useState<CatalogEntry[]>([]);
  const [cart, setCart] = useState<CartRow[]>([]);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Sale -> customer + payment
  const [saleCustomer, setSaleCustomer] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [salePayment, setSalePayment] = useState<PaymentMethod>("cash");
  const [saleDueDate, setSaleDueDate] = useState(creditDueDate);

  // Stock tab
  const [stockQuery, setStockQuery] = useState("");
  const [stockProductId, setStockProductId] = useState("");
  const [recvLot, setRecvLot] = useState("");
  const [recvQty, setRecvQty] = useState("10");
  const [recvMfg, setRecvMfg] = useState("");
  const [recvExpiry, setRecvExpiry] = useState("");
  const [recvSupplier, setRecvSupplier] = useState("");
  const [recvInvoiceNo, setRecvInvoiceNo] = useState("");
  const [recvDueDate, setRecvDueDate] = useState("");
  const [recvInvoiceNotes, setRecvInvoiceNotes] = useState("");
  const [recvCost, setRecvCost] = useState("");
  const [recvSalePrice, setRecvSalePrice] = useState("");
  const [priceEdit, setPriceEdit] = useState("");
  const [thresholdEdit, setThresholdEdit] = useState("5");
  const [recvPayStatus, setRecvPayStatus] = useState<PayStatus>("unpaid");
  const [recvPaidFrom, setRecvPaidFrom] = useState<"cash" | "bank">("cash");
  const [recvAmountPaid, setRecvAmountPaid] = useState("");
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Add-product form state
  const [apName, setApName] = useState("");
  const [apBrand, setApBrand] = useState("");
  const [apStrength, setApStrength] = useState("");
  const [apForm, setApForm] = useState("");
  const [apBarcode, setApBarcode] = useState("");
  const [apClass, setApClass] = useState("otc");
  const [apImageUrl, setApImageUrl] = useState("");
  const [apImageDataUrl, setApImageDataUrl] = useState<string | null>(null);
  const [apBusy, setApBusy] = useState(false);

  // Expiry tracking (admin)
  const [expiring, setExpiring] = useState<ExpiryItem[]>([]);

  // Accounts (customers)
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custBirth, setCustBirth] = useState("");
  const [custAge, setCustAge] = useState("");
  const [custAddress, setCustAddress] = useState("");

  // Sales + finance (admin)
  const [sales, setSales] = useState<SaleHistoryRow[]>([]);
  const [exceptions, setExceptions] = useState<InventoryException[]>([]);

  // Settings / HR
  const [pwNew, setPwNew] = useState("");

  const refresh = useCallback(async () => {
    const [catalog, st] = await Promise.all([
      window.api.catalog.list(),
      window.api.sync.status(),
    ]);
    setProducts(catalog);
    setStatus(st);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await window.api.sync.pull();
      } catch {
        setNotice("Couldn't reach the cloud — working offline.");
      }
      await refresh();
    })();
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (tab === "expiry" && isAdmin) {
      void loadExpiry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === "sales" && isAdmin) {
      void loadSales();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (tab === "accounts") void loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const saleSearchTerm = query.trim().toLocaleLowerCase();
  const saleMatches = saleSearchTerm
    ? products.filter((p) => p.stock > 0 && [
        p.canonical_name,
        p.brand_name,
        p.strength,
        p.dosage_form,
        p.barcode,
      ].some((value) => value?.toLocaleLowerCase().includes(saleSearchTerm)))
    : [];

  const stockFiltered = stockQuery
    ? products.filter(
        (p) =>
          p.canonical_name.toLowerCase().includes(stockQuery.toLowerCase()) ||
          (p.brand_name ?? "").toLowerCase().includes(stockQuery.toLowerCase()),
      )
    : [];

  const selectedProduct = products.find((p) => p.id === stockProductId);
  const selectedCustomer = customers.find((c) => c.id === saleCustomer);
  const filteredCustomers = customerSearch
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()),
      )
    : [];

  function addToCart(p: CatalogEntry) {
    setCart((c) => {
      const existing = c.find((row) => row.product_id === p.id);
      if (existing) {
        return c.map((row) =>
          row.product_id === p.id
            ? { ...row, quantity: row.quantity + 1 }
            : row,
        );
      }
      return [
        ...c,
        {
          product_id: p.id,
          canonical_name: p.canonical_name,
          quantity: 1,
          unit_price: p.price ?? 0,
        },
      ];
    });
    setQuery("");
    setSaleSearchOpen(false);
  }

  function setRow(idx: number, patch: Partial<CartRow>) {
    setCart((c) => c.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  async function checkout() {
    if (salePayment === "later" && !saleCustomer) {
      setNotice("Pick a customer to use 'pay later'.");
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const sale = await window.api.sale.create(
        cart.map((r) => ({
          product_id: r.product_id,
          quantity: r.quantity,
          unit_price: r.unit_price,
        })),
        { customer_id: saleCustomer || null, payment_method: salePayment, due_date: saleDueDate },
      );
      setLastSale(sale);
      setCart([]);
      setSaleCustomer("");
      setSalePayment("cash");
      setSaleDueDate(creditDueDate());
      await refresh();
      if (sale.shortages.length > 0) {
        setNotice(
          `${sale.shortages.map((s) => s.product_name).join(", ")} ${t("err.lowStock")} — ${t("sales.flagged")}.`,
        );
      }
    } catch (err) {
      setNotice(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function receive() {
    if (!stockProductId || !recvLot || Number(recvQty) <= 0) {
      setNotice("Pick a product, enter a lot number, and a quantity.");
      return;
    }
    if (!recvCost || Number(recvCost) < 0) {
      setNotice("Enter the unit cost.");
      return;
    }
    const total = Number(recvQty) * Number(recvCost);
    const amountPaid =
      recvPayStatus === "paid"
        ? total
        : recvPayStatus === "partial"
          ? Number(recvAmountPaid) || 0
          : 0;
    setBusy(true);
    setNotice(null);
    try {
      await window.api.stock.receive({
        product_id: stockProductId,
        lot_no: recvLot,
        expiry_date: recvExpiry || null,
        mfg_date: recvMfg || null,
        quantity: Number(recvQty),
        cost_price: null,
        sale_price: recvSalePrice ? Number(recvSalePrice) : null,
        supplier: recvSupplier.trim() || null,
        invoice_no: recvInvoiceNo.trim() || null,
        due_date: recvDueDate || null,
        notes: recvInvoiceNotes.trim() || null,
        unit_cost: Number(recvCost),
        payment_status: recvPayStatus,
        amount_paid: amountPaid,
        payment_method: recvPaidFrom,
      });
      setRecvLot("");
      setRecvQty("10");
      setRecvMfg("");
      setRecvExpiry("");
      setRecvSupplier("");
      setRecvInvoiceNo("");
      setRecvDueDate("");
      setRecvInvoiceNotes("");
      setRecvCost("");
      setRecvSalePrice("");
      setRecvPayStatus("unpaid");
      setRecvPaidFrom("cash");
      setRecvAmountPaid("");
      setNotice(t("ok.stockAdded"));
      await refresh();
    } catch (err) {
      setNotice(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function removeProductStock() {
    if (!stockProductId) return;
    if (!window.confirm("Remove ALL stock for this product?")) return;
    setBusy(true);
    try {
      const removed = await window.api.stock.remove(stockProductId);
      setNotice(`Removed ${removed} unit(s) from stock.`);
      setStockProductId("");
      await refresh();
    } catch (err) {
      setNotice(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function savePrice() {
    if (!stockProductId) return;
    const price = Number(priceEdit);
    if (!price || price < 0) {
      setNotice("Enter a valid price.");
      return;
    }
    setBusy(true);
    try {
      await window.api.product.setPrice(stockProductId, price);
      setNotice("Price saved.");
      await refresh();
    } catch (err) {
      setNotice(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveThreshold() {
    if (!stockProductId) return;
    const threshold = Number(thresholdEdit);
    if (!Number.isInteger(threshold) || threshold < 0) {
      setNotice("Enter a whole-number low-stock threshold.");
      return;
    }
    setBusy(true);
    try {
      await window.api.product.setThreshold(stockProductId, threshold);
      setNotice("Low-stock threshold saved. It will publish when this branch synchronizes.");
      await refresh();
    } catch (err) {
      setNotice(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function push() {
    setBusy(true);
    setNotice(null);
    try {
      const r = await window.api.sync.push();
      if (r.reconciliation) setExceptions(r.reconciliation.exceptions);
      setNotice(
        r.reason === "no-session"
          ? "No pharmacy linked to this account yet — sales stay queued locally."
          : `Pushed ${r.pushed} events, ${r.failed} failed.${r.reconciliation ? ` Reconciled ${r.reconciliation.compared} products; ${r.reconciliation.exceptions.length} exception(s).` : ""}`,
      );
      await refresh();
    } catch (err) {
      setNotice(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitProduct() {
    if (!apName.trim()) {
      setNotice("Enter a product name.");
      return;
    }
    setApBusy(true);
    setNotice(null);
    try {
      const created = await window.api.product.submit({
        canonical_name: apName.trim(),
        brand_name: apBrand.trim() || null,
        strength: apStrength.trim() || null,
        dosage_form: apForm.trim() || null,
        barcode: apBarcode.trim() || null,
        prescription_classification: apClass,
        image_url: apImageUrl.trim() || null,
        image_data_url: apImageDataUrl,
      });
      setNotice(
        `Product submitted (${created.id.slice(0, 8)}…) — pending admin verification.`,
      );
      setApName("");
      setApBrand("");
      setApStrength("");
      setApForm("");
      setApBarcode("");
      setApImageUrl("");
      setApImageDataUrl(null);
      await refresh();
    } catch (err) {
      setNotice(friendly(err));
    } finally {
      setApBusy(false);
    }
  }

  async function findImage() {
    if (!apName.trim()) {
      setNotice("Enter a name first to look up an image.");
      return;
    }
    setNotice("Looking up image…");
    const url = await window.api.product.lookupImage(apName.trim());
    if (url) {
      setApImageUrl(url);
      setNotice("Image found.");
    } else {
      setNotice("No automatic image found — attach one or paste a URL.");
    }
  }

  function onPickImage(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setApImageDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function loadCustomers() {
    setCustomers(await window.api.customers.list());
  }

  async function addCustomer() {
    if (!custName.trim()) {
      setNotice("Enter a customer name.");
      return;
    }
    setBusy(true);
    try {
      await window.api.customers.add({
        name: custName.trim(),
        phone: custPhone.trim() || null,
        birth_date: custBirth || null,
        age: custAge.trim() || null,
        address: custAddress.trim() || null,
      });
      setCustName("");
      setCustPhone("");
      setCustBirth("");
      setCustAge("");
      setCustAddress("");
      await loadCustomers();
      setNotice(t("ok.customerAdded"));
    } catch (err) {
      setNotice(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function settleCustomer(id: string) {
    setBusy(true);
    try {
      await window.api.customers.settle(id);
      await loadCustomers();
      setNotice(t("ok.paymentRecorded"));
    } catch (err) {
      setNotice(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function loadSales() {
    const [sl, ex] = await Promise.all([
      window.api.sales.list(),
      window.api.inventory.exceptions(),
    ]);
    setSales(sl);
    setExceptions(ex);
  }

  async function reconcile() {
    setBusy(true);
    try {
      const result = await window.api.sync.reconcile();
      setExceptions(result.exceptions);
      setNotice(`Reconciled ${result.compared} products; ${result.exceptions.length} exception(s) need review.`);
    } catch (err) {
      setNotice(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function loadExpiry() {
    setExpiring(await window.api.insights.expiring());
  }

  async function changePassword() {
    if (pwNew.trim().length < 6) {
      setNotice("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      await window.api.settings.changePassword(pwNew.trim());
      setPwNew("");
      setNotice(t("ok.passwordChanged"));
    } catch (err) {
      setNotice(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  const cartTotal = cart.reduce(
    (sum, r) => sum + r.quantity * r.unit_price,
    0,
  );

  return (
    <div className="pos">
      <header className="topbar">
        <div className="brand">
          <img className="brand-logo" src="./logo.png" alt="Shifa" />
          <strong>{t("app.name")}</strong>
        </div>

        <div className="tabs">
          <button className={tab === "sell" ? "active" : ""} onClick={() => setTab("sell")}>
            {t("tab.sell")}
          </button>
          <button className={tab === "stock" ? "active" : ""} onClick={() => setTab("stock")}>
            {t("tab.stock")}
          </button>
          {isAdmin && (
            <button className={tab === "sales" ? "active" : ""} onClick={() => setTab("sales")}>
              {t("tab.sales")}
            </button>
          )}
          {isAdmin && (
            <button className={tab === "finance" ? "active" : ""} onClick={() => setTab("finance")}>
              {t("tab.finance")}
            </button>
          )}
          {isAdmin && (
            <button className={tab === "expiry" ? "active" : ""} onClick={() => setTab("expiry")}>
              {t("tab.expiry")}
            </button>
          )}
          <button className={tab === "staff" ? "active" : ""} onClick={() => setTab("staff")}>
            Staff
          </button>
          <button className={tab === "accounts" ? "active" : ""} onClick={() => setTab("accounts")}>
            {t("tab.accounts")}
          </button>
          <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
            {t("tab.settings")}
          </button>
        </div>

        <div className="version-pill" title={`Shifa Pro version ${packageInfo.version}`}>
          <span>Shifa Pro</span>
          <strong>v{packageInfo.version}</strong>
        </div>

        <div className="user">
          <span>{session.branch_name ? `${session.branch_name} · ` : ""}{session.email}</span>
          <button className="link" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {tab === "sell" ? (
        <div className="layout">
          <section className="panel catalog">
            <div className="sale-search">
              <input
                className="search"
                placeholder={t("search.medicine")}
                value={query}
                aria-expanded={saleSearchOpen}
                aria-controls="sale-product-results"
                onFocus={() => setSaleSearchOpen(true)}
                onBlur={() => window.setTimeout(() => setSaleSearchOpen(false), 120)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSaleSearchOpen(true);
                }}
              />
              <p className="hint">{t("sale.searchHint")}</p>
              {saleSearchOpen && (
                <div id="sale-product-results" className="sale-search-dropdown">
                  {!saleSearchTerm ? (
                    <div className="sale-search-message">{t("sale.searchFocus")}</div>
                  ) : saleMatches.length > 0 ? (
                    saleMatches.slice(0, 12).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="product sale-search-option"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => addToCart(p)}
                      >
                        <div>
                          <div className="pname">{p.canonical_name}</div>
                          <div className="psub">
                            {[p.brand_name, p.strength, p.dosage_form]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </div>
                        <div className="sale-search-result-meta">
                          <span className="sale-search-price">
                            {p.price == null ? t("sale.priceNotSet") : formatSdg(p.price)}
                          </span>
                          <span className="stock in">{p.stock}</span>
                        </div>
                      </button>
                    ))
                  ) : products.some((p) => p.stock > 0) ? (
                    <div className="sale-search-message">{t("sale.searchNoMatch")}</div>
                  ) : (
                    <div className="sale-search-message">{t("sale.searchNoStock")}</div>
                  )}
                  {saleMatches.length > 12 && (
                    <div className="sale-search-footnote">{t("sale.searchRefine")}</div>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="panel cart">
            <h2>{t("sale.title")}</h2>
            {cart.length === 0 ? (
              <div className="empty">{t("sale.empty")}</div>
            ) : (
              <div className="cart-lines">
                <table className="cart-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Qty</th>
                      <th>Price (SDG)</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((r, i) => (
                      <tr key={r.product_id}>
                        <td>{r.canonical_name}</td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            value={r.quantity}
                            onChange={(e) =>
                              setRow(i, { quantity: Number(e.target.value) || 1 })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={r.unit_price}
                            onChange={(e) =>
                              setRow(i, { unit_price: Number(e.target.value) || 0 })
                            }
                          />
                        </td>
                        <td>
                          <button
                            className="link"
                            onClick={() => setCart((c) => c.filter((_, j) => j !== i))}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="form row">
              {selectedCustomer ? (
                <div className="customer-chip">
                  <span>{selectedCustomer.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSaleCustomer("");
                      setCustomerSearch("");
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <input
                  placeholder={t("sale.customerSearch")}
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                />
              )}
            </div>
            {!saleCustomer && !customerSearch && (
              <p className="hint">{t("sale.walkin")}</p>
            )}
            {customerSearch && !saleCustomer && (
              <div className="cust-suggestions">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="cust-suggestion"
                    onClick={() => {
                      setSaleCustomer(c.id);
                      setCustomerSearch("");
                    }}
                  >
                    <span>{c.name}</span>
                    {c.balance > 0 ? (
                      <span className="owes">owes {formatSdg(c.balance)}</span>
                    ) : null}
                  </button>
                ))}
                {filteredCustomers.length === 0 && (
                  <div className="empty">No customer found.</div>
                )}
              </div>
            )}
            <div className="form row">
              <select
                value={salePayment}
                onChange={(e) => setSalePayment(e.target.value as PaymentMethod)}
              >
                <option value="cash">{t("sale.cash")}</option>
                <option value="bank">{t("sale.bank")}</option>
                <option value="later">{t("sale.later")}</option>
              </select>
            </div>
            {salePayment === "later" && <label className="credit-due-date">Credit due date<input type="date" value={saleDueDate} onChange={event => setSaleDueDate(event.target.value)} required /></label>}

            <div className="total">
              {t("sale.total")} <strong>{formatSdg(cartTotal)}</strong>
            </div>
            <button
              className="primary"
              disabled={busy || cart.length === 0}
              onClick={checkout}
            >
              {busy ? (
                <>
                  <span className="spinner light" /> {t("sale.processing")}
                </>
              ) : (
                t("sale.complete")
              )}
            </button>

            {lastSale && (
              <div className="receipt">
                <strong>{lastSale.sale_no}</strong>
                <span>total {formatSdg(lastSale.total)}</span>
                <span>{lastSale.lines.length} line(s) · queued for sync</span>
                {lastSale.flagged && <span className="flag">{t("sales.flagged")}</span>}
              </div>
            )}
          </section>
        </div>
      ) : tab === "stock" ? (
        <div className="layout">
          <section className="panel catalog">
            <h2>{t("stock.add")}</h2>
            <input
              className="search"
              placeholder={t("search.medicine")}
              value={stockQuery}
              onChange={(e) => setStockQuery(e.target.value)}
            />
            <div className="list">
              {stockQuery &&
                stockFiltered.map((p) => (
                  <button
                    key={p.id}
                    className="product"
                    onClick={() => {
                      setStockProductId(p.id);
                      setStockQuery("");
                      setPriceEdit(p.price != null ? String(p.price) : "");
                      setThresholdEdit(String(p.low_stock_threshold ?? 5));
                    }}
                  >
                    <div>
                      <div className="pname">{p.canonical_name}</div>
                      <div className="psub">
                        {[p.brand_name, p.strength, p.dosage_form]
                          .filter(Boolean)
                          .join(" · ") || "—"}
                      </div>
                    </div>
                    <span className={`stock ${p.stock > 0 ? "in" : "out"}`}>
                      {p.stock}
                    </span>
                  </button>
                ))}
              {stockQuery && stockFiltered.length === 0 && (
                <div className="empty">{t("stock.noMatch")}</div>
              )}
              {!stockQuery && (
                <div className="empty">{t("stock.searchHint")}</div>
              )}
            </div>
          </section>

          <section className="panel">
            <h2>{t("stock.receive")}</h2>
            {selectedProduct ? (
              <>
                <div className="selected">
                  <strong>{selectedProduct.canonical_name}</strong>
                  {selectedProduct.brand_name
                    ? ` — ${selectedProduct.brand_name}`
                    : ""}
                  <span className="hint">
                    · {selectedProduct.stock} {t("stock.units")}
                  </span>
                  <button
                    className="clear"
                    title="Remove"
                    onClick={() => {
                      setStockProductId("");
                      setPriceEdit("");
                      setThresholdEdit("5");
                    }}
                  >
                    ✕
                  </button>
                </div>
                {isAdmin && (
                  <div className="price-row">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={`${t("stock.salePrice")} (SDG)`}
                      value={priceEdit}
                      onChange={(e) => setPriceEdit(e.target.value)}
                    />
                    <button className="secondary" onClick={savePrice} disabled={busy}>
                      {t("stock.savePrice")}
                    </button>
                  </div>
                )}
                {isAdmin && (
                  <div className="price-row">
                    <input
                      type="number"
                      min={0}
                      step="1"
                      placeholder="Low-stock threshold (units)"
                      value={thresholdEdit}
                      onChange={(e) => setThresholdEdit(e.target.value)}
                    />
                    <button className="secondary" onClick={saveThreshold} disabled={busy}>
                      Save threshold
                    </button>
                  </div>
                )}
                <div className="form">
                  <input
                    placeholder={t("stock.lot")}
                    value={recvLot}
                    onChange={(e) => setRecvLot(e.target.value)}
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder={t("stock.qty")}
                    value={recvQty}
                    onChange={(e) => setRecvQty(e.target.value)}
                  />
                  <label className="field-label">{t("stock.mfg")}</label>
                  <input
                    type="date"
                    value={recvMfg}
                    onChange={(e) => setRecvMfg(e.target.value)}
                  />
                  <label className="field-label">{t("stock.expiry")}</label>
                  <input
                    type="date"
                    value={recvExpiry}
                    onChange={(e) => setRecvExpiry(e.target.value)}
                  />
                  <input
                    placeholder={t("stock.supplier")}
                    value={recvSupplier}
                    onChange={(e) => setRecvSupplier(e.target.value)}
                  />
                  <input
                    placeholder="Supplier invoice number"
                    value={recvInvoiceNo}
                    onChange={(e) => setRecvInvoiceNo(e.target.value)}
                  />
                  <label className="field-label">Supplier due date</label>
                  <input
                    type="date"
                    value={recvDueDate}
                    onChange={(e) => setRecvDueDate(e.target.value)}
                  />
                  <input
                    placeholder="Invoice notes"
                    value={recvInvoiceNotes}
                    maxLength={240}
                    onChange={(e) => setRecvInvoiceNotes(e.target.value)}
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={`${t("stock.unitCost")} (SDG) *`}
                    value={recvCost}
                    onChange={(e) => setRecvCost(e.target.value)}
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={`${t("stock.salePrice")} (SDG)`}
                    value={recvSalePrice}
                    onChange={(e) => setRecvSalePrice(e.target.value)}
                  />
                  <label className="field-label">{t("stock.payment")}</label>
                  <select
                    value={recvPayStatus}
                    onChange={(e) => setRecvPayStatus(e.target.value as PayStatus)}
                  >
                    <option value="paid">{t("stock.paidFull")}</option>
                    <option value="partial">{t("stock.partial")}</option>
                    <option value="unpaid">{t("stock.unpaid")}</option>
                  </select>
                  {recvPayStatus !== "unpaid" && <>
                    <label className="field-label">Paid from</label>
                    <select value={recvPaidFrom} onChange={e => setRecvPaidFrom(e.target.value as "cash" | "bank")}>
                      <option value="cash">Cash</option><option value="bank">Bank</option>
                    </select>
                  </>}
                  {recvPayStatus === "partial" && (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={t("stock.amountPaid")}
                      value={recvAmountPaid}
                      onChange={(e) => setRecvAmountPaid(e.target.value)}
                    />
                  )}
                  <button className="primary" onClick={receive} disabled={busy}>
                    {t("stock.addToStock")}
                  </button>
                  {isAdmin && (
                    <button className="danger" onClick={removeProductStock} disabled={busy}>
                      {t("stock.removeAll")}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="empty">{t("stock.select")}</div>
            )}

            <hr className="divider" />
            <div className="row-between">
              <h2>{t("stock.newProduct")}</h2>
              <button className="secondary" onClick={() => setShowAddProduct((v) => !v)}>
                {showAddProduct ? "Hide" : "Show"}
              </button>
            </div>
            {showAddProduct && (
              <div className="form">
                <p className="hint">
                  Saved to the Shifa database as pending until an admin verifies
                  it.
                </p>
                <input
                  placeholder={`${t("stock.productName")} *`}
                  value={apName}
                  onChange={(e) => setApName(e.target.value)}
                />
                <input
                  placeholder={t("stock.brand")}
                  value={apBrand}
                  onChange={(e) => setApBrand(e.target.value)}
                />
                <input
                  placeholder={t("stock.strength")}
                  value={apStrength}
                  onChange={(e) => setApStrength(e.target.value)}
                />
                <input
                  placeholder={t("stock.form")}
                  value={apForm}
                  onChange={(e) => setApForm(e.target.value)}
                />
                <input
                  placeholder={t("stock.barcode")}
                  value={apBarcode}
                  onChange={(e) => setApBarcode(e.target.value)}
                />
                <select value={apClass} onChange={(e) => setApClass(e.target.value)}>
                  <option value="otc">OTC</option>
                  <option value="prescription">Prescription</option>
                  <option value="unknown">Unknown</option>
                </select>
                <input
                  placeholder="Image URL"
                  value={apImageUrl}
                  onChange={(e) => setApImageUrl(e.target.value)}
                />
                <div className="img-actions">
                  <button
                    type="button"
                    className="secondary"
                    onClick={findImage}
                    disabled={apBusy}
                  >
                    Find image
                  </button>
                  <label className="file-pick">
                    Attach photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                {apImageDataUrl && (
                  <img className="preview" src={apImageDataUrl} alt="preview" />
                )}
                <button className="primary" onClick={submitProduct} disabled={apBusy}>
                  {apBusy ? (
                    <>
                      <span className="spinner light" /> Submitting…
                    </>
                  ) : (
                    t("stock.submit")
                  )}
                </button>
              </div>
            )}
          </section>
        </div>
      ) : tab === "finance" && isAdmin ? (
        <Finance onNotice={setNotice} />
      ) : tab === "sales" && isAdmin ? (
        <div className="layout single">
          <section className="panel">
            <div className="row-between" style={{ paddingTop: 14 }}>
              <h2>{t("sales.title")}</h2>
            </div>
            <div className="hint" style={{ padding: "0 16px 12px" }}>
              Sales consume non-expired lots by FEFO. Every total is stored in SDG.
            </div>
            <div className="panel" style={{ margin: 16, padding: 16, background: "var(--surface-2, #f7f9fc)" }}>
              <div className="row-between">
                <div><h2>Inventory reconciliation</h2><p className="hint">Compare local lot balances with the shared pharmacy stock projection.</p></div>
                <button className="secondary" onClick={reconcile} disabled={busy}>Reconcile balance</button>
              </div>
            </div>
            <div style={{ margin: "0 16px" }}>
              <h2>Open inventory exceptions ({exceptions.length})</h2>
              {exceptions.length ? <table className="cart-table"><thead><tr><th>Product ID</th><th>Local lots</th><th>Shared</th><th>Exception</th></tr></thead>
                <tbody>{exceptions.map(ex => <tr key={ex.id}><td>{ex.product_id ?? "—"}</td><td>{ex.expected_quantity ?? "—"}</td><td>{ex.actual_quantity ?? "Unknown / missing"}</td><td>{ex.details}</td></tr>)}</tbody></table>
                : <p className="hint">No open balance exceptions.</p>}
            </div>
            {sales.length > 0 ? (
              <table className="cart-table">
                <thead>
                  <tr>
                    <th>Sale</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Payment</th>
                    <th>Items</th>
                    <th>Total (SDG)</th>
                    <th>COGS (SDG)</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => (
                    <tr key={s.id}>
                      <td>{s.sale_no}</td>
                      <td>{s.business_date} {s.created_at.slice(11, 16)}</td>
                      <td>{s.customer_name ?? "—"}</td>
                      <td>{s.payment_method ?? "—"}</td>
                      <td>
                        {s.items
                          .map((i) => `${i.product_name} × ${i.quantity}`)
                          .join(", ")}
                      </td>
                      <td>{formatSdg(s.total)}</td>
                      <td>{s.missing_cost_lines ? <span className="flag">Incomplete</span> : formatSdg(s.cogs)}</td>
                      <td>{s.flagged && <span className="flag">{t("sales.flagged")}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">No sales yet.</div>
            )}

          </section>
        </div>
      ) : tab === "expiry" && isAdmin ? (
        <div className="layout single">
          <section className="panel">
            <h2>{t("expiry.title")}</h2>
            <p className="hint">{t("expiry.hint")}</p>
            {expiring.length > 0 ? (
              <table className="cart-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Lot</th>
                    <th>Qty</th>
                    <th>Expires</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.map((e) => (
                    <tr key={e.batch_id}>
                      <td>{e.product_name}</td>
                      <td>{e.lot_no}</td>
                      <td>{e.quantity}</td>
                      <td>{e.expiry_date}</td>
                      <td>
                        <span className={`exp ${e.status}`}>
                          {e.days_left < 0 ? "Expired" : `${e.days_left}d`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">No stock expiring within 90 days.</div>
            )}
          </section>
        </div>
      ) : tab === "staff" ? (
        <Staff session={session} canManage={canManageTeam} onNotice={setNotice} />
      ) : tab === "accounts" ? (
        <div className="layout single">
          <section className="panel">
            <h2>{t("customers.title")}</h2>
            <p className="hint">
              Create customer accounts, track what they owe, and see what they
              buy most.
            </p>
            <div className="form">
              <input
                placeholder={`${t("customers.name")} *`}
                value={custName}
                onChange={(e) => setCustName(e.target.value)}
              />
              <input
                placeholder={t("customers.phone")}
                value={custPhone}
                onChange={(e) => setCustPhone(e.target.value)}
              />
              <label className="field-label">{t("customers.birth")}</label>
              <input
                type="date"
                value={custBirth}
                onChange={(e) => setCustBirth(e.target.value)}
              />
              <input
                placeholder={t("customers.age")}
                value={custAge}
                onChange={(e) => setCustAge(e.target.value)}
              />
              <input
                placeholder={t("customers.address")}
                value={custAddress}
                onChange={(e) => setCustAddress(e.target.value)}
              />
              <button className="primary" onClick={addCustomer} disabled={busy}>
                {t("customers.add")}
              </button>
            </div>

            {customers.length > 0 ? (
              <table className="cart-table">
                <thead>
                  <tr>
                    <th>{t("customers.name")}</th>
                    <th>{t("customers.phone")}</th>
                    <th>{t("customers.owes")}</th>
                    <th>{t("customers.buysMost")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        {c.name}
                        {(c.birth_date || c.age) && (
                          <div className="psub">
                            {[c.birth_date, c.age && `Age ${c.age}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                      </td>
                      <td>{c.phone ?? "—"}</td>
                      <td>
                        <span className={c.balance > 0 ? "owes" : "credit"}>
                          {formatSdg(c.balance)}
                        </span>
                      </td>
                      <td>
                        {c.top_products.length > 0
                          ? c.top_products
                              .map((tp) => `${tp.product_name} (${tp.total_quantity})`)
                              .join(", ")
                          : "—"}
                      </td>
                      <td>
                        {c.balance > 0 && (
                          <button className="link" onClick={() => settleCustomer(c.id)} disabled={busy}>
                            {t("customers.markPaid")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="empty">{t("customers.none")}</div>
            )}
          </section>
        </div>
      ) : (
        <div className="layout">
          <section className="panel">
            <h2>{t("settings.title")}</h2>

            <div className="setting-group">
              <div className="setting-row">
                <span>{t("settings.language")}</span>
                <div className="seg">
                  <button className={lang === "en" ? "active" : ""} onClick={() => setLang("en")}>
                    English
                  </button>
                  <button className={lang === "ar" ? "active" : ""} onClick={() => setLang("ar")}>
                    العربية
                  </button>
                </div>
              </div>
              <div className="setting-row">
                <span>{t("settings.theme")}</span>
                <div className="seg">
                  <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>
                    {t("settings.light")}
                  </button>
                  <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>
                    {t("settings.dark")}
                  </button>
                </div>
              </div>
            </div>

            <h2 className="mt">{t("settings.password")}</h2>
            <div className="form row">
              <input
                type="password"
                placeholder={t("settings.newPassword")}
                value={pwNew}
                onChange={(e) => setPwNew(e.target.value)}
              />
              <button className="primary" onClick={changePassword} disabled={busy}>
                {t("settings.changePassword")}
              </button>
            </div>

          </section>

          <section className="panel">
            <h2>Profile</h2>
            <div className="profile">
              <div className="avatar">
                {(session.email?.[0] ?? "?").toUpperCase()}
              </div>
              <div>
                <div className="profile-name">{session.email}</div>
                <div className="profile-role">
                  {isAdmin ? "Administrator" : "Staff"}
                </div>
              </div>
            </div>
            <div className="form">
              <button className="danger" onClick={onSignOut}>
                Sign out
              </button>
            </div>
            <h2 className="mt">Sync status</h2>
            <div className="setting-group settings-sync">
              <div className="setting-row">
                <span>Connection</span>
                <strong className={status?.connected ? "sync-connected" : "sync-offline"}>
                  {status ? (status.connected ? "Connected" : "Offline") : "Checking…"}
                </strong>
              </div>
              <div className="setting-row">
                <span>Catalogue products</span>
                <strong>{status ? status.product_count.toLocaleString() : "—"}</strong>
              </div>
              <div className="setting-row">
                <span>Changes waiting to sync</span>
                <strong>{status ? status.pending_ops.toLocaleString() : "—"}</strong>
              </div>
              <button className="secondary" onClick={push} disabled={busy}>
                {busy ? "Syncing…" : "Sync now"}
              </button>
            </div>
          </section>
        </div>
      )}

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}
