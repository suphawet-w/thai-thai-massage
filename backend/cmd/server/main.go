package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/thaithai/massage-booking/internal/api"
	"github.com/thaithai/massage-booking/internal/app"
	"github.com/thaithai/massage-booking/internal/auth"
	"github.com/thaithai/massage-booking/internal/config"
	"github.com/thaithai/massage-booking/internal/db"
)

func main() {
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("server stopped", "err", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := db.Connect(ctx, cfg.DatabaseURL, cfg.SimpleProtocol)
	if err != nil {
		return err
	}
	defer pool.Close()

	if err := db.Migrate(ctx, pool); err != nil {
		return err
	}

	authSvc := auth.New(pool, cfg.JWTSecret, cfg.JWTTTL)
	created, err := authSvc.EnsureOwner(ctx, cfg.AdminEmail, cfg.AdminPassword, cfg.AdminName)
	if err != nil {
		return err
	}
	if created {
		slog.Info("created owner account from ADMIN_EMAIL", "email", cfg.AdminEmail)
	}

	store := app.NewStore(pool, cfg.Location)
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           api.New(store, authSvc, cfg).Routes(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		slog.Info("Thai Thai Massage API listening", "port", cfg.Port, "tz", cfg.Location.String())
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}
	slog.Info("shutting down...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
