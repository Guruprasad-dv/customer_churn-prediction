# -*- coding: utf-8 -*-
import pandas as pd
import numpy as np
import json
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression

def train_and_export():
    print("Loading customer_churn.csv...")
    df = pd.read_csv('customer_churn.csv')
    
    # Drop CustomerID if it exists
    if 'CustomerID' in df.columns:
        df = df.drop('CustomerID', axis=1)
        
    print("Dataset shape:", df.shape)
    
    # Check for missing values and drop them if any
    if df.isnull().sum().sum() > 0:
        print("Dropping rows with missing values...")
        df = df.dropna()
        print("Dataset shape after clean:", df.shape)

    # 1. Define explicit label mappings for categorical columns
    gender_map = {'Female': 0, 'Male': 1}
    sub_type_map = {'Basic': 0, 'Premium': 1, 'Standard': 2}
    contract_map = {'Annual': 0, 'Monthly': 1, 'Quarterly': 2}
    
    # 2. Map categorical features
    df['Gender'] = df['Gender'].map(gender_map)
    df['Subscription Type'] = df['Subscription Type'].map(sub_type_map)
    df['Contract Length'] = df['Contract Length'].map(contract_map)
    
    # 3. Separate features and target
    X = df.drop('Churn', axis=1)
    y = df['Churn']
    
    # Train test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    print("Train shape:", X_train.shape, "Test shape:", X_test.shape)
    
    # Fit Logistic Regression model
    print("Training LogisticRegression model...")
    model = LogisticRegression(max_iter=1000)
    model.fit(X_train, y_train)
    
    # Calculate accuracy
    train_acc = model.score(X_train, y_train)
    test_acc = model.score(X_test, y_test)
    print(f"Train Accuracy: {train_acc:.4f}")
    print(f"Test Accuracy: {test_acc:.4f}")
    
    # Print Coefficients
    print("\nFeature Coefficients:")
    feature_names = list(X.columns)
    coefficients = model.coef_[0].tolist()
    intercept = float(model.intercept_[0])
    
    for feat, coef in zip(feature_names, coefficients):
        print(f"  {feat}: {coef:.6f}")
    print(f"  Intercept: {intercept:.6f}")
    
    # Calculate summary statistics to display on the dashboard
    print("\nGenerating dashboard statistics...")
    
    # Gender stats
    gender_counts = df['Gender'].value_counts().to_dict()
    gender_churn = df.groupby('Gender')['Churn'].mean().to_dict()
    
    # Contract stats
    contract_counts = df['Contract Length'].value_counts().to_dict()
    contract_churn = df.groupby('Contract Length')['Churn'].mean().to_dict()
    
    # Subscription stats
    sub_counts = df['Subscription Type'].value_counts().to_dict()
    sub_churn = df.groupby('Subscription Type')['Churn'].mean().to_dict()
    
    # Support call bucket stats
    df['Support Call Bucket'] = pd.cut(df['Support Calls'], bins=[-1, 2, 5, np.inf], labels=['0-2 calls', '3-5 calls', '6+ calls'])
    support_churn = df.groupby('Support Call Bucket', observed=False)['Churn'].mean().to_dict()
    support_counts = df['Support Call Bucket'].value_counts().to_dict()
    
    # Payment delay bucket stats
    df['Payment Delay Bucket'] = pd.cut(df['Payment Delay'], bins=[-1, 5, 15, np.inf], labels=['0-5 days', '6-15 days', '16+ days'])
    delay_churn = df.groupby('Payment Delay Bucket', observed=False)['Churn'].mean().to_dict()
    delay_counts = df['Payment Delay Bucket'].value_counts().to_dict()

    summary_stats = {
        "total_customers": int(len(df)),
        "overall_churn_rate": float(df['Churn'].mean()),
        "average_age": float(df['Age'].mean()),
        "average_tenure": float(df['Tenure'].mean()),
        "average_spend": float(df['Total Spend'].mean()),
        "average_support_calls": float(df['Support Calls'].mean()),
        "average_payment_delay": float(df['Payment Delay'].mean()),
        "gender_stats": {
            "counts": {str(k): int(v) for k, v in gender_counts.items()},
            "churn_rates": {str(k): float(v) for k, v in gender_churn.items()}
        },
        "contract_stats": {
            "counts": {str(k): int(v) for k, v in contract_counts.items()},
            "churn_rates": {str(k): float(v) for k, v in contract_churn.items()}
        },
        "subscription_stats": {
            "counts": {str(k): int(v) for k, v in sub_counts.items()},
            "churn_rates": {str(k): float(v) for k, v in sub_churn.items()}
        },
        "support_stats": {
            "counts": {str(k): int(v) for k, v in support_counts.items()},
            "churn_rates": {str(k): float(v) for k, v in support_churn.items()}
        },
        "delay_stats": {
            "counts": {str(k): int(v) for k, v in delay_counts.items()},
            "churn_rates": {str(k): float(v) for k, v in delay_churn.items()}
        }
    }
    
    # Prepare model assets JSON structure
    model_assets = {
        "features": feature_names,
        "coefficients": coefficients,
        "intercept": intercept,
        "categorical_mappings": {
            "Gender": gender_map,
            "Subscription Type": sub_type_map,
            "Contract Length": contract_map
        },
        "summary_stats": summary_stats,
        "train_accuracy": train_acc,
        "test_accuracy": test_acc
    }
    
    # Write to model_assets.json
    with open('model_assets.json', 'w') as f:
        json.dump(model_assets, f, indent=4)
        
    print("\nModel assets and summary stats successfully written to model_assets.json!")

if __name__ == '__main__':
    train_and_export()
