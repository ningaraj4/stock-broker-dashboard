package database

import (
	"stockbroker/backend/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func Connect(databasePath string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(databasePath), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	if err := db.Exec("PRAGMA foreign_keys = ON").Error; err != nil {
		return nil, err
	}

	if err := db.AutoMigrate(&models.User{}, &models.Subscription{}); err != nil {
		return nil, err
	}

	return db, nil
}
