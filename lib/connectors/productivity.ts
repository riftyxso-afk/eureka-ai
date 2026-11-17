import { randomUUID } from "node:crypto";
import { accessToken } from "./server";
import type { ConnectorId } from "./catalog";

type Input = { provider: ConnectorId; action: string; query: string; id: string; title: string; text: string; url?: string };
export async function productivityTool(userId: string, input: Input) {
  const write = input.action === "create";
  const token = await accessToken(userId, input.provider, write);
  const request = async (url: string, body?: unknown, headers: Record<string,string> = {}, method?: "PUT") => {
    const response = await fetch(url, { method: method ?? (body === undefined ? "GET" : "POST"),
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", ...headers },
      ...(body === undefined ? {} : { body: method === "PUT" ? String(body) : JSON.stringify(body) }), signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error("Aplikasi menolak permintaan (" + response.status + "). Periksa izin koneksi.");
    const result = await response.json();
    if (result.ok === false) throw new Error("Aplikasi menolak permintaan. Periksa izin dan lokasi tujuan.");
    return result;
  };
  const id = (value: string) => {
    if (!/^[a-zA-Z0-9_!.-]{1,160}$/.test(value)) throw new Error("Tentukan id lokasi tujuan dari aplikasi.");
    return encodeURIComponent(value);
  };
  switch (input.provider) {
    case "github": {
      if (!write) return request("https://api.github.com/search/issues?" + new URLSearchParams({ q: input.query, per_page: "15" }));
      if (!/^[\w.-]+\/[\w.-]+$/.test(input.id)) throw new Error("Tentukan repositori owner/repo untuk membuat issue.");
      return request("https://api.github.com/repos/" + input.id + "/issues", { title: input.title, body: input.text });
    }
    case "todoist":
      return write ? request("https://api.todoist.com/api/v1/tasks", { content: input.title, description: input.text })
        : request("https://api.todoist.com/api/v1/tasks");
    case "slack":
      return write ? request("https://slack.com/api/chat.postMessage", { channel: input.id, text: input.text, unfurl_links: false })
        : request("https://slack.com/api/search.messages?" + new URLSearchParams({ query: input.query, count: "15" }));
    case "discord": {
      if (!input.id) throw new Error("Tentukan id channel Discord yang diizinkan.");
      return request("https://discord.com/api/v10/channels/" + id(input.id) + "/messages" + (write ? "" : "?limit=20"),
        write ? { content: input.text.slice(0, 2000), allowed_mentions: { parse: [] } } : undefined, { Authorization: "Bot " + token });
    }
    case "trello": {
      const separator = token.indexOf(":");
      if (separator < 1) throw new Error("Kredensial Trello harus berformat API_KEY:TOKEN.");
      const params = new URLSearchParams({ key: token.slice(0,separator), token: token.slice(separator+1) });
      if (!write) { params.set("query",input.query); params.set("modelTypes","cards"); params.set("cards_limit","15"); return request("https://api.trello.com/1/search?" + params); }
      params.set("idList",input.id);params.set("name",input.title);params.set("desc",input.text);
      return request("https://api.trello.com/1/cards?" + params, {});
    }
    case "zotero": {
      const headers = { "Zotero-API-Key": token, "Zotero-API-Version": "3" };
      const identity = await request("https://api.zotero.org/keys/current", undefined, headers);
      if (!identity.userID) throw new Error("Akses pustaka Zotero belum tersedia.");
      const library = "https://api.zotero.org/users/" + id(String(identity.userID)) + "/items";
      if (!write) return request(library + "?" + new URLSearchParams({ q: input.query, limit: "20", format: "json" }), undefined, headers);
      const url = URL.canParse(input.url ?? "") ? new URL(input.url!) : null;
      if (!url || !["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Sertakan URL sumber untuk disimpan di Zotero.");
      const result = await request(library, [{
        itemType: "webpage", title: input.title.trim() || url.hostname, url: url.href,
        abstractNote: input.text, tags: [], collections: [], relations: {},
      }], headers);
      const item = result.successful?.["0"];
      if (!item?.key) throw new Error("Zotero belum menyimpan referensi. Periksa izin tulis pustaka.");
      return { key: item.key, title: item.data?.title, url: item.links?.alternate?.href };
    }
    case "onedrive":
    case "microsoft": {
      const drive = "https://graph.microsoft.com/v1.0/me/drive";
      if (write) {
        if (!input.text.trim()) throw new Error("Tentukan isi file yang ingin disimpan.");
        const name = input.title.replace(/[\u0000-\u001f"*:<>?\/\\|#%]/g, " ").replace(/\.txt$/i, "").trim().slice(0, 100) || "Catatan Eureka";
        const filename = `${name} - ${randomUUID().slice(0, 8)}.txt`;
        return request(`${drive}/root:/${encodeURIComponent(filename)}:/content`, input.text,
          { "Content-Type": "text/plain; charset=utf-8", "If-None-Match": "*" }, "PUT");
      }
      if (input.action === "read" && input.id) {
        const itemPath = `${drive}/items/${id(input.id)}`;
        const item = await request(itemPath);
        if (!item.file?.mimeType?.startsWith("text/") || !Number.isFinite(item.size) || item.size > 80_000) return item;
        const response = await fetch(itemPath + "/content", {
          headers: { Authorization: "Bearer " + token }, signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error("Isi file Microsoft belum dapat dibaca.");
        return { name: item.name, webUrl: item.webUrl, text: (await response.text()).slice(0, 18_000) };
      }
      const escaped = input.query.replace(/'/g,"''");
      return request(drive + "/root/search(q='" + encodeURIComponent(escaped) + "')?$top=15");
    }
    case "teams": {
      const separator = input.id.indexOf(":");
      const team = input.id.slice(0, separator), channel = input.id.slice(separator + 1);
      if (separator < 1 || !/^[\w.-]+$/.test(team) || !/^[\w.:@-]+$/.test(channel)) throw new Error("Tentukan teamId:channelId untuk membaca percakapan Teams.");
      const endpoint = "https://graph.microsoft.com/v1.0/teams/" + encodeURIComponent(team) + "/channels/" + encodeURIComponent(channel) + "/messages";
      if (!write) return request(endpoint + "?$top=20");
      if (!input.text.trim()) throw new Error("Tentukan isi pesan Teams sebelum mengirim.");
      return request(endpoint, { body: { contentType: "text", content: input.text } });
    }
    default: throw new Error("Alat konektor belum tersedia.");
  }
}
