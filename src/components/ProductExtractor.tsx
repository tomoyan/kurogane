"use client";

import { useState, useCallback, useRef } from "react";
import {
  Search, Link2, Loader2, Copy, Check, DollarSign,
  Package, Ruler, Palette, FileText, Tag, RefreshCw,
  TrendingDown, TrendingUp, Zap, AlertCircle, ChevronDown, ChevronUp
} from "lucide-react";
import styles from "./ProductExtractor.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Product {
  productId: string;
  nameEn: string;
  nameJa: string;
  brand: string;
  material: string;
  dimensions: string;
  color: string;
  priceUsd: number | null;
  summaryEn: string;
  summaryJa: string;
  category: string;
  confidence: "high" | "medium" | "low";
}

interface RateCache {
  rate: number;
  fetchedAt: number;
}

const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours
const RATE_KEY = "usd_jpy_rate_cache";

// ─── Pricing Formula ─────────────────────────────────────────────────────────

function calcJpy(usd: number, rate: number): number {
  const raw = (((usd * 1.1) * (rate + 10)) + 7000) * 1.1 * 1.05;
  return Math.floor(raw / 10) * 10;
}

function applyAdjustment(price: number, adj: number): number {
  return Math.floor((price * (1 + adj / 100)) / 10) * 10;
}

function fmtJpy(n: number): string {
  return "¥" + n.toLocaleString("ja-JP");
}

function fmtUsd(n: number): string {
  return "$" + n.toFixed(2);
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useClipboard() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    });
  }, []);
  return { copied, copy };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CopyBtn({ text, id, copied, copy }: { text: string; id: string; copied: string | null; copy: (t: string, k: string) => void }) {
  const active = copied === id;
  return (
    <button
      className={`${styles.copyBtn} ${active ? styles.copyBtnActive : ""}`}
      onClick={() => copy(text, id)}
      title="Copy"
    >
      {active ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function FieldRow({ label, value, icon, id, copied, copy }: {
  label: string; value: string; icon: React.ReactNode;
  id: string; copied: string | null; copy: (t: string, k: string) => void;
}) {
  if (!value || value === "N/A") return null;
  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldIcon}>{icon}</div>
      <div className={styles.fieldContent}>
        <span className={styles.fieldLabel}>{label}</span>
        <span className={styles.fieldValue}>{value}</span>
      </div>
      <CopyBtn text={value} id={id} copied={copied} copy={copy} />
    </div>
  );
}

function PriceCard({ label, jpy, adj, color, copied, copy }: {
  label: string; jpy: number; adj?: number; color: string;
  copied: string | null; copy: (t: string, k: string) => void;
}) {
  const key = `price-${label}`;
  return (
    <div className={`${styles.priceCard} ${styles[`priceCard_${color}`]}`}>
      <div className={styles.priceCardLabel}>{label}</div>
      <div className={styles.priceCardValue}>{fmtJpy(jpy)}</div>
      {adj !== undefined && (
        <div className={styles.priceCardAdj}>
          {adj > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {adj > 0 ? "+" : ""}{adj}%
        </div>
      )}
      <CopyBtn text={fmtJpy(jpy)} id={key} copied={copied} copy={copy} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductExtractor() {
  const [inputMode, setInputMode] = useState<"url" | "search">("url");
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [rate, setRate] = useState<number | null>(null);
  const [rateFetchedAt, setRateFetchedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualUsd, setManualUsd] = useState<string>("");
  const [quickUsd, setQuickUsd] = useState<string>("");
  const [quickResult, setQuickResult] = useState<number | null>(null);
  const [showFormula, setShowFormula] = useState(false);
  const { copied, copy } = useClipboard();
  const abortRef = useRef(false);

  // ── Rate fetching ──────────────────────────────────────────────────────────

  async function getRate(): Promise<number> {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(RATE_KEY);
      if (cached) {
        const parsed: RateCache = JSON.parse(cached);
        if (Date.now() - parsed.fetchedAt < CACHE_TTL) {
          setRate(parsed.rate);
          setRateFetchedAt(parsed.fetchedAt);
          return parsed.rate;
        }
      }
    }
    const res = await fetch("/api/rate");
    const data = await res.json();
    const cache: RateCache = { rate: data.rate, fetchedAt: data.fetchedAt };
    if (typeof window !== "undefined") {
      localStorage.setItem(RATE_KEY, JSON.stringify(cache));
    }
    setRate(data.rate);
    setRateFetchedAt(data.fetchedAt);
    return data.rate;
  }

  async function forceRefreshRate() {
    if (typeof window !== "undefined") localStorage.removeItem(RATE_KEY);
    setRate(null);
    const r = await getRate();
    setRate(r);
  }

  // ── Extraction ─────────────────────────────────────────────────────────────

  async function handleExtract() {
    if (!inputValue.trim()) return;
    setLoading(true);
    setError(null);
    setProduct(null);
    setProgress(0);
    abortRef.current = false;

    const steps = [
      [10, "Checking exchange rate cache…"],
      [25, "Fetching USD/JPY rate…"],
      [45, "Sending to AI for analysis…"],
      [70, "Extracting product data…"],
      [88, "Translating to Japanese…"],
      [95, "Calculating JPY pricing…"],
    ];

    let stepIdx = 0;
    const ticker = setInterval(() => {
      if (stepIdx < steps.length) {
        const [p, msg] = steps[stepIdx];
        setProgress(p as number);
        setStatusMsg(msg as string);
        stepIdx++;
      }
    }, 600);

    try {
      const fetchedRate = await getRate();

      const body = inputMode === "url"
        ? { url: inputValue }
        : { searchText: inputValue };

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Extraction failed");

      clearInterval(ticker);
      setProgress(100);
      setStatusMsg("Done!");
      setProduct(data.product);
      setRate(fetchedRate);
      if (data.product.priceUsd) {
        setManualUsd(String(data.product.priceUsd));
      }
    } catch (err) {
      clearInterval(ticker);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 800);
    }
  }

  // ── Quick price ────────────────────────────────────────────────────────────

  async function handleQuickPrice() {
    const usd = parseFloat(quickUsd);
    if (isNaN(usd) || usd <= 0) return;
    let r = rate;
    if (!r) r = await getRate();
    setQuickResult(calcJpy(usd, r));
  }

  // ── Derived pricing ────────────────────────────────────────────────────────

  const activeUsd = manualUsd ? parseFloat(manualUsd) : product?.priceUsd ?? null;
  const baseJpy = activeUsd && rate ? calcJpy(activeUsd, rate) : null;

  const rateAge = rateFetchedAt
    ? Math.round((Date.now() - rateFetchedAt) / 60000)
    : null;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className={styles.root}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerLeft}>
            <div className={styles.logo}>
              <Zap size={16} />
            </div>
            <div>
              <h1 className={styles.title}>JPY Price Tool</h1>
              <p className={styles.subtitle}>AI Product Extractor & Import Pricing</p>
            </div>
          </div>
          {rate && (
            <div className={styles.rateChip}>
              <span className={styles.rateLabel}>USD/JPY</span>
              <span className={styles.rateValue}>{rate.toFixed(2)}</span>
              <span className={styles.rateAge}>{rateAge}m ago</span>
              <button onClick={forceRefreshRate} className={styles.rateRefresh} title="Refresh rate">
                <RefreshCw size={11} />
              </button>
            </div>
          )}
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.layout}>

          {/* Left column — input + results */}
          <div className={styles.leftCol}>

            {/* Input card */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Product Input</span>
                <div className={styles.modeTabs}>
                  <button
                    className={`${styles.modeTab} ${inputMode === "url" ? styles.modeTabActive : ""}`}
                    onClick={() => setInputMode("url")}
                  >
                    <Link2 size={12} /> URL
                  </button>
                  <button
                    className={`${styles.modeTab} ${inputMode === "search" ? styles.modeTabActive : ""}`}
                    onClick={() => setInputMode("search")}
                  >
                    <Search size={12} /> Search
                  </button>
                </div>
              </div>

              <div className={styles.inputRow}>
                <input
                  className={styles.input}
                  type={inputMode === "url" ? "url" : "text"}
                  placeholder={inputMode === "url" ? "https://example.com/product" : "Search product name or SKU…"}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleExtract()}
                  disabled={loading}
                />
                <button
                  className={styles.extractBtn}
                  onClick={handleExtract}
                  disabled={loading || !inputValue.trim()}
                >
                  {loading ? <Loader2 size={15} className={styles.spin} /> : <Zap size={15} />}
                  {loading ? "Analyzing…" : "Extract"}
                </button>
              </div>

              {loading && (
                <div className={styles.progressWrap}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                  </div>
                  <span className={styles.progressMsg}>{statusMsg}</span>
                </div>
              )}

              {error && (
                <div className={styles.errorBox}>
                  <AlertCircle size={14} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Product result */}
            {product && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>Product Details</span>
                  <span className={`${styles.confidenceBadge} ${styles[`conf_${product.confidence}`]}`}>
                    {product.confidence} confidence
                  </span>
                </div>

                <div className={styles.productNames}>
                  <div className={styles.nameEn}>
                    {product.nameEn}
                    <CopyBtn text={product.nameEn} id="nameEn" copied={copied} copy={copy} />
                  </div>
                  <div className={styles.nameJa}>
                    {product.nameJa}
                    <CopyBtn text={product.nameJa} id="nameJa" copied={copied} copy={copy} />
                  </div>
                </div>

                <div className={styles.fields}>
                  <FieldRow label="PRODUCT ID" value={product.productId} icon={<Tag size={13} />} id="id" copied={copied} copy={copy} />
                  <FieldRow label="BRAND" value={product.brand} icon={<Package size={13} />} id="brand" copied={copied} copy={copy} />
                  <FieldRow label="CATEGORY" value={product.category} icon={<Package size={13} />} id="cat" copied={copied} copy={copy} />
                  <FieldRow label="MATERIAL" value={product.material} icon={<Package size={13} />} id="mat" copied={copied} copy={copy} />
                  <FieldRow label="DIMENSIONS" value={product.dimensions} icon={<Ruler size={13} />} id="dim" copied={copied} copy={copy} />
                  <FieldRow label="COLOR" value={product.color} icon={<Palette size={13} />} id="col" copied={copied} copy={copy} />
                </div>

                <div className={styles.summarySection}>
                  <div className={styles.summaryBlock}>
                    <div className={styles.summaryLabelRow}>
                      <FileText size={12} />
                      <span className={styles.fieldLabel}>SUMMARY (EN)</span>
                      <CopyBtn text={product.summaryEn} id="sumEn" copied={copied} copy={copy} />
                    </div>
                    <p className={styles.summaryText}>{product.summaryEn}</p>
                  </div>
                  <div className={styles.summaryBlock}>
                    <div className={styles.summaryLabelRow}>
                      <FileText size={12} />
                      <span className={styles.fieldLabel}>概要（日本語）</span>
                      <CopyBtn text={product.summaryJa} id="sumJa" copied={copied} copy={copy} />
                    </div>
                    <p className={styles.summaryText}>{product.summaryJa}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right column — pricing */}
          <div className={styles.rightCol}>

            {/* Quick price check */}
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.cardTitle}>Quick Price Check</span>
              </div>
              <div className={styles.quickRow}>
                <div className={styles.quickInputWrap}>
                  <DollarSign size={13} className={styles.quickIcon} />
                  <input
                    className={styles.quickInput}
                    type="number"
                    placeholder="USD amount"
                    value={quickUsd}
                    onChange={(e) => setQuickUsd(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleQuickPrice()}
                  />
                </div>
                <button className={styles.quickBtn} onClick={handleQuickPrice}>
                  Convert
                </button>
              </div>
              {quickResult && (
                <div className={styles.quickResult}>
                  <span className={styles.quickResultLabel}>Retail Price</span>
                  <span className={styles.quickResultValue}>{fmtJpy(quickResult)}</span>
                  <CopyBtn text={fmtJpy(quickResult)} id="quickRes" copied={copied} copy={copy} />
                </div>
              )}
            </div>

            {/* Full pricing panel */}
            {product && rate && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>JPY Pricing</span>
                  {product.priceUsd && (
                    <span className={styles.usdSource}>{fmtUsd(product.priceUsd)} extracted</span>
                  )}
                </div>

                {/* Manual USD override */}
                <div className={styles.overrideRow}>
                  <label className={styles.overrideLabel}>USD PRICE OVERRIDE</label>
                  <div className={styles.overrideInputWrap}>
                    <DollarSign size={13} className={styles.quickIcon} />
                    <input
                      className={styles.overrideInput}
                      type="number"
                      placeholder={product.priceUsd ? String(product.priceUsd) : "Enter USD"}
                      value={manualUsd}
                      onChange={(e) => setManualUsd(e.target.value)}
                    />
                  </div>
                </div>

                {baseJpy && (
                  <>
                    {/* Base price */}
                    <div className={styles.basePriceRow}>
                      <div className={styles.basePriceLabel}>BASE RETAIL PRICE</div>
                      <div className={styles.basePriceValue}>{fmtJpy(baseJpy)}</div>
                      <CopyBtn text={fmtJpy(baseJpy)} id="base" copied={copied} copy={copy} />
                    </div>

                    {/* Adjustments grid */}
                    <div className={styles.priceGrid}>
                      <PriceCard label="−20%" jpy={applyAdjustment(baseJpy, -20)} adj={-20} color="indigo" copied={copied} copy={copy} />
                      <PriceCard label="−10%" jpy={applyAdjustment(baseJpy, -10)} adj={-10} color="indigo" copied={copied} copy={copy} />
                      <PriceCard label="+10%" jpy={applyAdjustment(baseJpy, 10)} adj={10} color="rose" copied={copied} copy={copy} />
                      <PriceCard label="+20%" jpy={applyAdjustment(baseJpy, 20)} adj={20} color="rose" copied={copied} copy={copy} />
                    </div>

                    {/* Formula breakdown */}
                    <button
                      className={styles.formulaToggle}
                      onClick={() => setShowFormula(!showFormula)}
                    >
                      {showFormula ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      Formula breakdown
                    </button>

                    {showFormula && (
                      <div className={styles.formulaBox}>
                        <div className={styles.formulaLine}>
                          <span>USD Price</span>
                          <span>{fmtUsd(activeUsd!)}</span>
                        </div>
                        <div className={styles.formulaLine}>
                          <span>+ Import Tax (10%)</span>
                          <span>{fmtUsd(activeUsd! * 0.1)}</span>
                        </div>
                        <div className={styles.formulaLine}>
                          <span>× (Rate + ¥10 spread)</span>
                          <span>× {(rate + 10).toFixed(2)}</span>
                        </div>
                        <div className={styles.formulaLine}>
                          <span>+ Int'l Shipping</span>
                          <span>¥7,000</span>
                        </div>
                        <div className={styles.formulaLine}>
                          <span>× Profit Markup (10%)</span>
                          <span>× 1.10</span>
                        </div>
                        <div className={styles.formulaLine}>
                          <span>× Handling Fee (5%)</span>
                          <span>× 1.05</span>
                        </div>
                        <div className={styles.formulaLine}>
                          <span>Round down to ¥10</span>
                          <span>↓</span>
                        </div>
                        <div className={`${styles.formulaLine} ${styles.formulaTotal}`}>
                          <span>RETAIL PRICE</span>
                          <span>{fmtJpy(baseJpy)}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!activeUsd && (
                  <div className={styles.noPriceMsg}>
                    <AlertCircle size={14} />
                    No USD price found. Enter one above to calculate.
                  </div>
                )}
              </div>
            )}

            {/* Rate info */}
            {!rate && !loading && (
              <div className={styles.card}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardTitle}>Exchange Rate</span>
                </div>
                <p className={styles.rateHint}>Rate will be fetched automatically when you extract a product, or you can trigger it via a quick price check.</p>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
}
