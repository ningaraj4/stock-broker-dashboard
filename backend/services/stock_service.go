package services

import (
	"context"
	"math"
	"math/rand"
	"sync"
	"time"
)

var SupportedStocks = []string{
	"GOOG",
	"TSLA",
	"AMZN",
	"META",
	"NVDA",
}

var startingPrices = map[string]float64{
	"GOOG": 142.50,
	"TSLA": 177.20,
	"AMZN": 186.80,
	"META": 498.60,
	"NVDA": 121.40,
}

type StockSnapshot struct {
	StockCode string  `json:"stockCode"`
	Price     float64 `json:"price"`
}

type StockUpdate struct {
	StockCode string    `json:"stockCode"`
	Price     float64   `json:"price"`
	Timestamp time.Time `json:"timestamp"`
}

type StockService struct {
	mu     sync.RWMutex
	prices map[string]float64
	random *rand.Rand
}

func NewStockService() *StockService {
	prices := make(map[string]float64, len(startingPrices))
	for code, price := range startingPrices {
		prices[code] = price
	}

	return &StockService{
		prices: prices,
		random: rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

func (s *StockService) GetAllStocks() []StockSnapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stocks := make([]StockSnapshot, 0, len(SupportedStocks))
	for _, code := range SupportedStocks {
		stocks = append(stocks, StockSnapshot{
			StockCode: code,
			Price:     s.prices[code],
		})
	}

	return stocks
}

func (s *StockService) IsSupportedStock(code string) bool {
	for _, stockCode := range SupportedStocks {
		if stockCode == code {
			return true
		}
	}

	return false
}

func (s *StockService) Start(ctx context.Context, interval time.Duration, onUpdate func(StockUpdate)) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case tickTime := <-ticker.C:
			updates := s.generateNextPrices(tickTime.UTC())
			for _, update := range updates {
				onUpdate(update)
			}
		}
	}
}

func (s *StockService) generateNextPrices(timestamp time.Time) []StockUpdate {
	s.mu.Lock()
	defer s.mu.Unlock()

	updates := make([]StockUpdate, 0, len(SupportedStocks))
	for _, code := range SupportedStocks {
		current := s.prices[code]
		delta := (s.random.Float64() * 4) - 2
		nextPrice := math.Max(current+delta, 0.01)
		nextPrice = math.Round(nextPrice*100) / 100
		s.prices[code] = nextPrice

		updates = append(updates, StockUpdate{
			StockCode: code,
			Price:     nextPrice,
			Timestamp: timestamp,
		})
	}

	return updates
}
