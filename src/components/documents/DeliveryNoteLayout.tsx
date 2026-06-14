import { format } from "date-fns";
import { fr } from "date-fns/locale";
import logoUrl from "@/assets/logo-cleanup.jpg";

interface DeliveryNoteItem {
  ticketNumber: string;
  clientName: string;
  serviceName: string;
  sentAt: string;
}

interface DeliveryNoteProps {
  partnerName: string;
  partnerPhone?: string;
  partnerAddress?: string;
  items: DeliveryNoteItem[];
  type: "send" | "receive";
}

export function printDeliveryNote({
  partnerName,
  partnerPhone,
  partnerAddress,
  items,
  type,
}: DeliveryNoteProps) {
  const title =
    type === "send" ? "Bordereau d'Envoi" : "Bordereau de Réception";
  const now = format(new Date(), "dd/MM/yyyy HH:mm", { locale: fr });

  const itemRows = items
    .map(
      (item, i) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;text-align:center">${i + 1}</td>
        <td style="padding:8px;border:1px solid #ddd">${item.ticketNumber}</td>
        <td style="padding:8px;border:1px solid #ddd">${item.clientName}</td>
        <td style="padding:8px;border:1px solid #ddd">${item.serviceName}</td>
        <td style="padding:8px;border:1px solid #ddd">${format(new Date(item.sentAt), "dd/MM/yyyy", { locale: fr })}</td>
      </tr>`
    )
    .join("");

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title} - ${partnerName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 30px; color: #1a1a1a; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
        .company { font-size: 18px; font-weight: 700; }
        .company-sub { font-size: 12px; color: #666; margin-top: 2px; }
        .doc-title { text-align: center; font-size: 20px; font-weight: 700; margin: 20px 0; padding: 10px; background: #f3f4f6; border-radius: 6px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
        .info-box { padding: 12px; border: 1px solid #e5e7eb; border-radius: 6px; }
        .info-box h3 { font-size: 11px; text-transform: uppercase; color: #999; margin-bottom: 6px; letter-spacing: 0.5px; }
        .info-box p { font-size: 13px; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        th { padding: 10px 8px; background: #1a1a1a; color: white; font-size: 12px; text-align: left; }
        td { font-size: 13px; }
        .total { text-align: right; font-size: 14px; font-weight: 600; margin: 12px 0; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
        .sig-box { text-align: center; }
        .sig-box p { font-size: 12px; color: #666; margin-bottom: 60px; }
        .sig-line { border-top: 1px solid #333; padding-top: 4px; font-size: 11px; color: #999; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 12px; }
        @media print { body { padding: 15px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div style="display: flex; align-items: center; gap: 16px;">
          <img src="${window.location.origin}${logoUrl}" alt="Clean Up Logo" style="height: 60px;" />
          <div>
            <div class="company">CLEAN UP SARL</div>
            <div class="company-sub">
            49 RUE Koufrah DOUALA<br/>
            Tél: 693896155 / 671420308<br/>
            NIU: M032416634417L | RCCM: CM-DLA-03-2024-B12-00178<br/>
            Email: cleanupatelier2022@gmail.com
          </div>
        </div>
        <div style="text-align:right;font-size:12px;color:#666">
          <div>Date: ${now}</div>
          <div>Réf: BL-${Date.now().toString(36).toUpperCase()}</div>
        </div>
      </div>

      <div class="doc-title">${title}</div>

      <div class="info-grid">
        <div class="info-box">
          <h3>Expéditeur</h3>
          <p><strong>${type === "send" ? "CLEAN UP SARL" : partnerName}</strong></p>
        </div>
        <div class="info-box">
          <h3>Destinataire</h3>
          <p>
            <strong>${type === "send" ? partnerName : "CLEAN UP SARL"}</strong><br/>
            ${partnerPhone ? `Tél: ${partnerPhone}<br/>` : ""}
            ${partnerAddress || ""}
          </p>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width:40px;text-align:center">#</th>
            <th>N° Ticket</th>
            <th>Client</th>
            <th>Service</th>
            <th>Date Envoi</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <div class="total">${items.length} article${items.length > 1 ? "s" : ""}</div>

      <div class="signatures">
        <div class="sig-box">
          <p>Remis par :</p>
          <div class="sig-line">Nom, Signature & Date</div>
        </div>
        <div class="sig-box">
          <p>Reçu par :</p>
          <div class="sig-line">Nom, Signature & Date</div>
        </div>
      </div>

      <div class="footer">
        <p>Document généré le ${now} — CLEAN UP SARL</p>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}
