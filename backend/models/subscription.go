package models

type Subscription struct {
	ID        uint   `json:"id" gorm:"primaryKey"`
	UserID    uint   `json:"userId" gorm:"not null;index:idx_user_stock,unique"`
	StockCode string `json:"stockCode" gorm:"not null;index:idx_user_stock,unique"`
	User      User   `json:"-" gorm:"constraint:OnDelete:CASCADE;foreignKey:UserID"`
}
