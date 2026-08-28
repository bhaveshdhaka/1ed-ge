// mockd — mocks static server + append-only annotation feedback.
// Deliberately stdlib-only. Feedback = JSONL on a PVC; never lost, no expiry.
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type note struct {
	Ts       string  `json:"ts"`
	Page     string  `json:"page"`
	Selector string  `json:"selector"`
	Text     string  `json:"text,omitempty"`
	X        float64 `json:"x,omitempty"`
	Y        float64 `json:"y,omitempty"`
	W        float64 `json:"w,omitempty"`
	H        float64 `json:"h,omitempty"`
	Vw       int     `json:"vw,omitempty"`
	Vh       int     `json:"vh,omitempty"`
	Note     string  `json:"note"`
}

var (
	mu   sync.Mutex
	path string
	dir  string
)

func clip(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) > n {
		r := []rune(s)
		if len(r) > n {
			s = string(r[:n])
		}
	}
	return s
}

func handleFeedback(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch r.Method {
	case http.MethodPost:
		var n note
		body := http.MaxBytesReader(w, r.Body, 1<<15)
		if err := json.NewDecoder(body).Decode(&n); err != nil {
			http.Error(w, `{"ok":false,"error":"bad json"}`, 400)
			return
		}
		n.Note = clip(n.Note, 2000)
		n.Page = clip(n.Page, 200)
		n.Selector = clip(n.Selector, 500)
		n.Text = clip(n.Text, 300)
		if n.Note == "" || n.Page == "" {
			http.Error(w, `{"ok":false,"error":"page and note required"}`, 400)
			return
		}
		n.Ts = time.Now().UTC().Format(time.RFC3339)
		line, _ := json.Marshal(n)
		mu.Lock()
		defer mu.Unlock()
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			http.Error(w, `{"ok":false,"error":"storage"}`, 500)
			return
		}
		f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
		if err != nil {
			http.Error(w, `{"ok":false,"error":"storage"}`, 500)
			return
		}
		defer f.Close()
		if _, err := f.Write(append(line, '\n')); err != nil {
			http.Error(w, `{"ok":false,"error":"storage"}`, 500)
			return
		}
		w.WriteHeader(201)
		w.Write([]byte(`{"ok":true}`))

	case http.MethodGet:
		q := strings.Trim(r.URL.Query().Get("page"), "/")
		mu.Lock()
		raw, err := os.ReadFile(path)
		mu.Unlock()
		if err != nil {
			w.Write([]byte(`{"notes":[]}`))
			return
		}
		out := []json.RawMessage{}
		for _, ln := range strings.Split(strings.TrimSpace(string(raw)), "\n") {
			if ln == "" {
				continue
			}
			var probe struct {
				Page string `json:"page"`
			}
			if json.Unmarshal([]byte(ln), &probe) != nil {
				continue
			}
			if q != "" && strings.Trim(probe.Page, "/") != q {
				continue
			}
			out = append(out, json.RawMessage(ln))
		}
		json.NewEncoder(w).Encode(map[string]any{"notes": out})

	default:
		http.Error(w, `{"ok":false}`, 405)
	}
}

func main() {
	dir = getenv("HTML_DIR", "/srv/html")
	path = getenv("FEEDBACK_PATH", "/data/feedback.jsonl")
	addr := ":" + getenv("PORT", "80")

	mux := http.NewServeMux()
	mux.HandleFunc("/api/feedback", handleFeedback)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		w.Write([]byte("ok"))
	})
	// Extensionless asset routes (/st/...) bypass zone cache rules that pin
	// 4h TTL onto .css/.js. HTML + API never cached; assets no-cache too —
	// this is an iteration surface, staleness is the enemy.
	mux.Handle("/st/", stAssets(dir))
	mux.Handle("/", cache(http.FileServer(http.Dir(dir))))

	log.Printf("mockd: html=%s feedback=%s addr=%s", dir, path, addr)
	log.Fatal(http.ListenAndServe(addr, mux))
}

func cache(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := r.URL.Path
		switch {
		case strings.HasSuffix(p, ".html") || p == "/":
			w.Header().Set("Cache-Control", "no-cache, must-revalidate")
		default:
			w.Header().Set("Cache-Control", "no-cache")
		}
		next.ServeHTTP(w, r)
	})
}

// stAssets serves /st/<css|js>/<name> → <dir>/st/<kind>/<name>.<ext>,
// extensionless over the wire so CDN cache rules can't pin TTLs.
func stAssets(root string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rel := strings.TrimPrefix(r.URL.Path, "/st/")
		if strings.Contains(rel, "..") {
			http.NotFound(w, r)
			return
		}
		var ct string
		switch {
		case strings.HasPrefix(rel, "css/"):
			ct = "text/css; charset=utf-8"
			rel += ".css"
		case strings.HasPrefix(rel, "js/"):
			ct = "application/javascript; charset=utf-8"
			rel += ".js"
		case strings.HasPrefix(rel, "data/"):
			ct = "application/json; charset=utf-8" // fixture files carry their own .json suffix
		default:
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", ct)
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, filepath.Join(root, "st", filepath.Clean(rel)))
	})
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
