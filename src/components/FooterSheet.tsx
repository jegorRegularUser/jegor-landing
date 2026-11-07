import { useLang } from '../i18n/LangContext';

/** ЛИСТ 08 — Регистрация изменений (футер, §4.8): без анимаций кроме ревила. */
export function FooterSheet() {
  const { t } = useLang();
  return (
    <footer className="sheet footer-sheet" id="sheet-08" aria-label={t.footer.kicker}>
      <div className="sheet__paper">
        <div className="sheet__kicker">
          <span className="sheet__kicker-label">{t.footer.kicker}</span>
          <span className="sheet__kicker-rule" aria-hidden="true" />
        </div>
        <table>
          <thead>
            <tr>
              <th scope="col">{t.footer.head.izm}</th>
              <th scope="col">{t.footer.head.sheets}</th>
              <th scope="col">{t.footer.head.content}</th>
              <th scope="col">{t.footer.head.date}</th>
            </tr>
          </thead>
          <tbody>
            {t.footer.rows.map((r) => (
              <tr key={r.izm}>
                <td>{r.izm}</td>
                <td>{r.sheets}</td>
                <td>{r.content}</td>
                <td>{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="footer-sheet__meta">
          <span>{t.footer.note}</span>
          <span>{t.footer.copyright}</span>
        </div>
      </div>
    </footer>
  );
}
