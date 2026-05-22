const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = __dirname;
const GEO_SERVER_HOST = "localhost";
const GEO_SERVER_PORT = 8080;
const PORT = 3000;
const DEFAULT_DATABASE = "binhduong_gis";
const DEFAULT_PGUSER = "postgres";
const DEFAULT_PGPASSWORD = "1";
const DEFAULT_PGHOST = "localhost";
const DEFAULT_PGPORT = "5432";

function resolvePsqlPath() {
  if (process.env.PSQL_PATH) {
    return process.env.PSQL_PATH;
  }

  const candidates = [];
  if (process.platform === "win32") {
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    for (const baseDir of [programFiles, programFilesX86, "C:\\PostgreSQL"]) {
      try {
        if (!fs.existsSync(baseDir)) {
          continue;
        }
        const subdirs = fs.readdirSync(baseDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
        for (const entry of subdirs) {
          candidates.push(path.join(baseDir, entry.name, "bin", "psql.exe"));
        }
      } catch (err) {
        // ignore directory scan errors and continue with other candidates
      }
    }
  }

  candidates.push("psql");

  for (const candidate of candidates) {
    try {
      if (candidate === "psql") {
        return candidate;
      }
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (err) {
      // continue searching
    }
  }

  return "psql";
}

function geoJson4326(expr) {
  return `ST_AsGeoJSON(${safeGeomSql(expr, 4326)})::jsonb`;
}

function normalizeVietnameseSql(expr) {
  return `translate(lower(trim(${expr})), 'àáạảãăằắặẳẵâầấậẩẫđèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹ', 'aaaaaaaaaaaaaaaaadeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyy')`;
}

function safeGeomSql(expr, targetSrid = 4326) {
  return `CASE
    WHEN ST_SRID(${expr}) = 0 THEN ST_SetSRID(${expr}, ${targetSrid})
    WHEN ST_SRID(${expr}) = ${targetSrid} THEN ${expr}
    ELSE ST_Transform(${expr}, ${targetSrid})
  END`;
}

const QUERY_SQL = {
  q1: [
    `SELECT COALESCE(jsonb_agg(result), '[]'::jsonb)::text AS payload
FROM (
  SELECT jsonb_build_object(
    'name', name,
    'population', population,
    'area', area,
    'geometry', ${geoJson4326("geom")}
  ) AS result
  FROM public."Dia_gioi_hanh_chinh_Binh_Duong"
  WHERE name LIKE 'Phường %'
  ORDER BY name
) result;`,
    `SELECT COALESCE(jsonb_agg(result), '[]'::jsonb)::text AS payload
FROM (
  SELECT jsonb_build_object(
    'name', name,
    'population', population,
    'area', area,
    'geometry', ${geoJson4326("geom")}
  ) AS result
  FROM public."Dia_gioi_hanh_chinh_Binh_Duong"
  WHERE lower(trim(name)) LIKE 'phuong %'
  ORDER BY name
) result;`,
  ],
  q2: [
    `SELECT COALESCE(jsonb_agg(result), '[]'::jsonb)::text AS payload
FROM (
  SELECT jsonb_build_object(
    'truong_hoc', t.name,
    'phuong_xa', p.name,
    'geometry', ${geoJson4326("t.geom")}
  ) AS result
  FROM public."Truong_hoc" t
  JOIN public."Dia_gioi_hanh_chinh_Binh_Duong" p
    ON ST_Intersects(t.geom, p.geom)
  WHERE p.name = 'Phường Dĩ An'
  ORDER BY t.name
) result;`,
    `SELECT COALESCE(jsonb_agg(result), '[]'::jsonb)::text AS payload
FROM (
  SELECT jsonb_build_object(
    'truong_hoc', t.name,
    'phuong_xa', p.name,
    'geometry', ${geoJson4326("t.geom")}
  ) AS result
  FROM public."Truong_hoc" t
  JOIN public."Dia_gioi_hanh_chinh_Binh_Duong" p
    ON ST_Intersects(ST_MakeValid(${safeGeomSql("t.geom")}), ST_MakeValid(${safeGeomSql("p.geom")}))
  WHERE lower(trim(p.name)) LIKE '%di an%'
  ORDER BY t.name
) result;`,
  ],
  q3: [
    `WITH chon_truong_hoc AS (
  SELECT geom
  FROM public."Truong_hoc"
  LIMIT 1
)
SELECT COALESCE(jsonb_agg(result), '[]'::jsonb)::text AS payload
FROM (
  SELECT jsonb_build_object(
    'name', COALESCE(d.name, '(khong ten)'),
    'geometry', ${geoJson4326("d.geom")}
  ) AS result
  FROM public."Duong_giao_thong" d
  CROSS JOIN chon_truong_hoc c
  WHERE ST_DWithin(d.geom, c.geom, 500)
  ORDER BY COALESCE(d.name, '(khong ten)')
) result;`,
    `WITH chon_truong_hoc AS (
  SELECT ST_MakeValid(${safeGeomSql("geom")}) AS geom
  FROM public."Truong_hoc"
  LIMIT 1
)
SELECT COALESCE(jsonb_agg(result), '[]'::jsonb)::text AS payload
FROM (
  SELECT jsonb_build_object(
    'name', COALESCE(d.name, '(khong ten)'),
    'geometry', ${geoJson4326("d.geom")}
  ) AS result
  FROM public."Duong_giao_thong" d
  CROSS JOIN chon_truong_hoc c
  WHERE ST_DWithin(ST_MakeValid(${safeGeomSql("d.geom")}), c.geom, 500)
  ORDER BY COALESCE(d.name, '(khong ten)')
) result;`,
    `WITH chon_truong_hoc AS (
  SELECT ST_MakeValid(${safeGeomSql("geom", 4326)})::geography AS geog
  FROM public."Truong_hoc"
  WHERE geom IS NOT NULL
  LIMIT 1
)
SELECT COALESCE(jsonb_agg(result), '[]'::jsonb)::text AS payload
FROM (
  SELECT jsonb_build_object(
    'name', COALESCE(d.name, '(khong ten)'),
    'geometry', ${geoJson4326("d.geom")}
  ) AS result
  FROM public."Duong_giao_thong" d
  CROSS JOIN chon_truong_hoc c
  WHERE ST_DWithin(ST_MakeValid(${safeGeomSql("d.geom", 4326)})::geography, c.geog, 500)
  ORDER BY COALESCE(d.name, '(khong ten)')
) result;`,
  ],
  q4: [`WITH chon_truong_hoc AS (
  SELECT geom
  FROM public."Truong_hoc"
  LIMIT 1
)
SELECT COALESCE(jsonb_agg(result), '[]'::jsonb)::text AS payload
FROM (
  SELECT jsonb_build_object(
    'name', COALESCE(u.name, '(khong ten)'),
    'distance_m', ST_Distance(u.geom, c.geom),
    'geometry', ${geoJson4326("u.geom")}
  ) AS result
  FROM public."UBND" u
  CROSS JOIN chon_truong_hoc c
  ORDER BY ST_Distance(u.geom, c.geom)
  LIMIT 1
) result;`],
  q5: [`SELECT COALESCE(jsonb_agg(result), '[]'::jsonb)::text AS payload
FROM (
  SELECT jsonb_build_object(
    'name', p.name,
    'so_truong_hoc', COUNT(t.*),
    'geometry', ${geoJson4326("p.geom")}
  ) AS result
  FROM public."Dia_gioi_hanh_chinh_Binh_Duong" p
  LEFT JOIN public."Truong_hoc" t
    ON ST_Contains(p.geom, t.geom)
  GROUP BY p.name, p.geom
  HAVING COUNT(t.*) > 0
  ORDER BY COUNT(t.*) DESC, p.name
) result;`],
};

function runQueryWithFallback(queryId, sqlOrList) {
  const candidates = Array.isArray(sqlOrList) ? sqlOrList : [sqlOrList];
  let lastError = null;
  const retryOnEmpty = queryId === "q1" || queryId === "q2";

  for (let idx = 0; idx < candidates.length; idx += 1) {
    const sql = candidates[idx];
    try {
      const rows = runPsqlQuery(sql);
      if (retryOnEmpty && Array.isArray(rows) && rows.length === 0 && idx < candidates.length - 1) {
        continue;
      }
      return rows;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Khong thuc thi duoc truy van.");
}

function runPsqlQuery(sql) {
  const psqlPath = resolvePsqlPath();
  const databaseTarget = process.env.PGDATABASE || process.env.DB_NAME || DEFAULT_DATABASE;
  const pgUser = process.env.PGUSER || DEFAULT_PGUSER;
  const pgPassword = process.env.PGPASSWORD || DEFAULT_PGPASSWORD;
  const pgHost = process.env.PGHOST || DEFAULT_PGHOST;
  const pgPort = process.env.PGPORT || DEFAULT_PGPORT;
  const result = spawnSync(
    psqlPath,
    ["-h", pgHost, "-p", pgPort, "-d", databaseTarget, "-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql],
    {
      env: {
        ...process.env,
        PGUSER: pgUser,
        PGPASSWORD: pgPassword,
        PGHOST: pgHost,
        PGPORT: pgPort,
        PGDATABASE: databaseTarget,
        PGCONNECT_TIMEOUT: process.env.PGCONNECT_TIMEOUT || "5",
        PGOPTIONS: process.env.PGOPTIONS || "-c client_min_messages=warning",
      },
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (result.error) {
    throw new Error(result.error.message);
  }

  if (result.status !== 0) {
    throw new Error((result.stderr || "").trim() || `psql exited with code ${result.status}`);
  }

  const payload = (result.stdout || "").trim();
  if (!payload) {
    return [];
  }

  return JSON.parse(payload);
}

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function handleApiQuery(req, res, queryId) {
  if (req.method !== "GET") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  const sql = QUERY_SQL[queryId];
  if (!sql) {
    sendJson(res, 404, { ok: false, error: "Unknown query" });
    return;
  }

  try {
    const rows = runQueryWithFallback(queryId, sql);
    sendJson(res, 200, { ok: true, queryId, rows });
  } catch (err) {
    sendJson(res, 500, {
      ok: false,
      error: err.message,
      hint: `Kiem tra psql va thong tin ket noi Postgres. Server dang co gang dung ${DEFAULT_PGHOST}:${DEFAULT_PGPORT}, database ${DEFAULT_DATABASE}, user ${DEFAULT_PGUSER}.`,
    });
  }
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function serveStatic(req, res, pathname) {
  const filePath = pathname === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, pathname);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function proxyToGeoServer(req, res) {
  const proxyReq = http.request(
    {
      hostname: GEO_SERVER_HOST,
      port: GEO_SERVER_PORT,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    },
  );

  proxyReq.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(`Proxy error: ${err.message}`);
  });

  req.pipe(proxyReq, { end: true });
}

http
  .createServer((req, res) => {
    const requestUrl = new URL(req.url, `http://localhost:${PORT}`);

    if (requestUrl.pathname.startsWith("/api/query/")) {
      handleApiQuery(req, res, requestUrl.pathname.split("/").pop());
      return;
    }

    if (requestUrl.pathname.startsWith("/geoserver/")) {
      proxyToGeoServer(req, res);
      return;
    }

    serveStatic(req, res, requestUrl.pathname);
  })
  .listen(PORT, () => {
    console.log(`WebGIS running at http://localhost:${PORT}`);
  });