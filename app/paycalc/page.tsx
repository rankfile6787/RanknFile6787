export default function PayCalcPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0b1120" }}>
      <iframe
        src="/legacy-paycalc/index.html"
        title="6787 Pay Calculator"
        style={{
          width: "100%",
          minHeight: "100vh",
          border: 0,
          display: "block",
        }}
      />
    </main>
  );
}
