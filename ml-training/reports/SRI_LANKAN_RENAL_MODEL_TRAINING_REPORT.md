# Sri Lankan renal model training report

Training completed: 2026-10-09T04:58:30.742012+00:00

This is an executed retrospective research evaluation. It is not clinical validation. Original raw data and secondary-use permission were not supplied.

Canonical input: 391 supplied rows → 386 unique chronological rows, 42 patients, 2024-01-01 through 2024-12-01.
Master demographics: 45 subjects. Alternate monthly matrix: 387 rows / 42 patients; not added to the cohort.

Patient partitions (before target filtering): {"train": 24, "validation": 9, "test": 9}

Patient-disjoint GroupShuffleSplit; fixed seeds 42/43, approximately 60/20/20. Median imputation and standardization fit inside each training fold only. Three-fold GroupKFold uses training patients only.

Features and targets use shared preprocessing; target is the immediate next chronological record of the same patient, restricted to 14–62 days. No replacement/interpolation of missing outcomes. Unknown absolute urea and uric acid units are excluded.

Candidate hyperparameters are fixed before evaluation and saved in metadata. Numeric model selection uses validation MAE only. Prespecified gate: at least 5% better than persistence and better than the other simple baselines. Test performance does not select the model.

| Target | Candidate | Served method | Eligible pairs | Train patients/rows | Validation patients/rows | Test patients/rows | Candidate test MAE | Persistence test MAE |
|---|---|---|---:|---|---|---|---:|---:|
| HB | XGBoost | PERSISTENCE_BASELINE | 341 | 23/190 | 9/72 | 9/79 | 0.9101 | 0.8709 |
| URR | XGBoost | RESEARCH_MODEL | 340 | 23/191 | 9/70 | 9/79 | 11.0023 | 12.1215 |

## HB

```json
{
  "Ridge": {
    "validation": {
      "MAE": 1.1282747747617572,
      "RMSE": 1.3560554627685528,
      "R2": 0.3666103100407505,
      "MedianAbsoluteError": 0.9969090754515841
    },
    "test": {
      "MAE": 0.9450125081545595,
      "RMSE": 1.2342579245552143,
      "R2": 0.579093942648407,
      "MedianAbsoluteError": 0.7766266945268345
    }
  },
  "RandomForest": {
    "validation": {
      "MAE": 1.049420991564876,
      "RMSE": 1.2744941289770837,
      "R2": 0.44051072850490425,
      "MedianAbsoluteError": 0.9522972123042823
    },
    "test": {
      "MAE": 0.9102167389411774,
      "RMSE": 1.1475565871997158,
      "R2": 0.6361506966449817,
      "MedianAbsoluteError": 0.7449783378909629
    }
  },
  "XGBoost": {
    "validation": {
      "MAE": 1.0431643883387247,
      "RMSE": 1.2807568745509772,
      "R2": 0.4349986623543314,
      "MedianAbsoluteError": 1.0120828628540037
    },
    "test": {
      "MAE": 0.91007538807543,
      "RMSE": 1.1492473677220132,
      "R2": 0.6350777342758371,
      "MedianAbsoluteError": 0.6754026412963867
    }
  },
  "LightGBM": {
    "validation": {
      "MAE": 1.083203359313529,
      "RMSE": 1.3075976954258783,
      "R2": 0.41106905089737467,
      "MedianAbsoluteError": 1.0377002997771623
    },
    "test": {
      "MAE": 0.9030609588716191,
      "RMSE": 1.1488133227429622,
      "R2": 0.6353533281487435,
      "MedianAbsoluteError": 0.7488259636564543
    }
  },
  "baselines": {
    "Persistence": {
      "validation": {
        "MAE": 0.9791666666666666,
        "RMSE": 1.2341213698642268,
        "R2": 0.475395719590736,
        "MedianAbsoluteError": 0.7749999999999995
      },
      "test": {
        "MAE": 0.8708860759493672,
        "RMSE": 1.1163911115393435,
        "R2": 0.6556452584008614,
        "MedianAbsoluteError": 0.7000000000000011
      }
    },
    "RollingMean3": {
      "validation": {
        "MAE": 1.1260416666666666,
        "RMSE": 1.3845407632135647,
        "R2": 0.33972085847381106,
        "MedianAbsoluteError": 1.0250000000000004
      },
      "test": {
        "MAE": 1.0561181434599152,
        "RMSE": 1.3613150339504938,
        "R2": 0.48797565725682046,
        "MedianAbsoluteError": 0.7666666666666657
      }
    },
    "TrainingMean": {
      "validation": {
        "MAE": 1.6320029239766076,
        "RMSE": 1.9292160703365848,
        "R2": -0.281969894886521,
        "MedianAbsoluteError": 1.5
      },
      "test": {
        "MAE": 1.6871419053964023,
        "RMSE": 2.0012307444279465,
        "R2": -0.10654138085354092,
        "MedianAbsoluteError": 1.6589473684210514
      }
    }
  },
  "group_kfold_train_only": {
    "Ridge": [
      {
        "MAE": 1.0003143851830707,
        "RMSE": 1.1757802967457434,
        "R2": 0.4946521025278784,
        "MedianAbsoluteError": 0.9183950529789016
      },
      {
        "MAE": 1.1408917246479835,
        "RMSE": 1.4360857754440672,
        "R2": 0.4349362772092841,
        "MedianAbsoluteError": 0.9689539822874256
      },
      {
        "MAE": 0.8861786163564032,
        "RMSE": 1.1569819942856925,
        "R2": 0.6190435805183416,
        "MedianAbsoluteError": 0.6730778091985492
      }
    ],
    "RandomForest": [
      {
        "MAE": 0.8456724362921755,
        "RMSE": 1.0153086665092363,
        "R2": 0.6231796979916993,
        "MedianAbsoluteError": 0.7599260502339122
      },
      {
        "MAE": 1.0113167002207437,
        "RMSE": 1.3266174752585538,
        "R2": 0.5177990150432842,
        "MedianAbsoluteError": 0.8478526849676697
      },
      {
        "MAE": 0.8180596563573174,
        "RMSE": 1.052755897725378,
        "R2": 0.6845885448903148,
        "MedianAbsoluteError": 0.6221539889741319
      }
    ],
    "XGBoost": [
      {
        "MAE": 0.8612652570009234,
        "RMSE": 1.0375691552567643,
        "R2": 0.6064751047490694,
        "MedianAbsoluteError": 0.8372583389282227
      },
      {
        "MAE": 1.0211442644633941,
        "RMSE": 1.3349120707514242,
        "R2": 0.5117502993976785,
        "MedianAbsoluteError": 0.9275350570678711
      },
      {
        "MAE": 0.8102585656302315,
        "RMSE": 1.0786808430533787,
        "R2": 0.6688627577576052,
        "MedianAbsoluteError": 0.601765441894532
      }
    ],
    "LightGBM": [
      {
        "MAE": 0.9043985071924123,
        "RMSE": 1.1258205288299252,
        "R2": 0.5366849221090617,
        "MedianAbsoluteError": 0.8096117751149903
      },
      {
        "MAE": 0.9722135849285942,
        "RMSE": 1.2917914093562475,
        "R2": 0.5427839687348657,
        "MedianAbsoluteError": 0.7883444505575898
      },
      {
        "MAE": 0.8204265598502837,
        "RMSE": 1.0949077409432868,
        "R2": 0.658825040841397,
        "MedianAbsoluteError": 0.639277859940842
      }
    ]
  },
  "selected_candidate": "XGBoost",
  "served_method": "PERSISTENCE_BASELINE",
  "served_test": {
    "MAE": 0.8708860759493672,
    "RMSE": 1.1163911115393435,
    "R2": 0.6556452584008614,
    "MedianAbsoluteError": 0.7000000000000011
  },
  "selected_candidate_test_cluster_bootstrap": {
    "method": "Patient-cluster bootstrap, 500 resamples, exploratory small-cohort CI",
    "patients": 9,
    "MAE_95CI": [
      0.6989764477901396,
      1.155845172173017
    ],
    "baseline_minus_model_MAE_95CI": [
      -0.12014716879914414,
      0.054683036597536545
    ]
  },
  "temporal": {
    "cutoff": "2024-09-01",
    "strategy": "Same-cohort temporal, training target dates <=cutoff; test feature dates >=cutoff, no future training outcomes",
    "train_rows": 234,
    "test_rows": 107,
    "patient_overlap_expected": true,
    "model": {
      "MAE": 0.9010608655270017,
      "RMSE": 1.197448080940898,
      "R2": 0.5091239815424924,
      "MedianAbsoluteError": 0.6509181976318352
    },
    "persistence": {
      "MAE": 0.9481308411214954,
      "RMSE": 1.2379229665161064,
      "R2": 0.47537899968005537,
      "MedianAbsoluteError": 0.7000000000000011
    }
  },
  "exploratory_classification": {
    "LogisticRegression": {
      "validation": {
        "Accuracy": 0.625,
        "BalancedAccuracy": 0.5698051948051949,
        "Precision": 0.6545454545454545,
        "Recall": 0.8181818181818182,
        "Sensitivity": 0.8181818181818182,
        "Specificity": 0.32142857142857145,
        "F1": 0.7272727272727273,
        "ROC_AUC": 0.6371753246753247,
        "PR_AUC_average_precision": 0.6813541802863703,
        "BrierScore": 0.24232440030172697,
        "ConfusionMatrix": [
          [
            9,
            19
          ],
          [
            8,
            36
          ]
        ],
        "PositiveEvents": 44,
        "NegativeEvents": 28,
        "threshold": 0.5
      },
      "test": {
        "Accuracy": 0.5316455696202531,
        "BalancedAccuracy": 0.43541364296081275,
        "Precision": 0.6333333333333333,
        "Recall": 0.7169811320754716,
        "Sensitivity": 0.7169811320754716,
        "Specificity": 0.15384615384615385,
        "F1": 0.672566371681416,
        "ROC_AUC": 0.5174165457184324,
        "PR_AUC_average_precision": 0.7200142799453026,
        "BrierScore": 0.2656211830456452,
        "ConfusionMatrix": [
          [
            4,
            22
          ],
          [
            15,
            38
          ]
        ],
        "PositiveEvents": 53,
        "NegativeEvents": 26,
        "threshold": 0.5
      }
    },
    "RandomForest": {
      "validation": {
        "Accuracy": 0.625,
        "BalancedAccuracy": 0.5568181818181819,
        "Precision": 0.6440677966101694,
        "Recall": 0.8636363636363636,
        "Sensitivity": 0.8636363636363636,
        "Specificity": 0.25,
        "F1": 0.7378640776699029,
        "ROC_AUC": 0.700487012987013,
        "PR_AUC_average_precision": 0.7644895567220034,
        "BrierScore": 0.2143335973379432,
        "ConfusionMatrix": [
          [
            7,
            21
          ],
          [
            6,
            38
          ]
        ],
        "PositiveEvents": 44,
        "NegativeEvents": 28,
        "threshold": 0.5
      },
      "test": {
        "Accuracy": 0.6708860759493671,
        "BalancedAccuracy": 0.5587808417997098,
        "Precision": 0.7014925373134329,
        "Recall": 0.8867924528301887,
        "Sensitivity": 0.8867924528301887,
        "Specificity": 0.23076923076923078,
        "F1": 0.7833333333333333,
        "ROC_AUC": 0.5667634252539914,
        "PR_AUC_average_precision": 0.7357556993646968,
        "BrierScore": 0.2278209623133548,
        "ConfusionMatrix": [
          [
            6,
            20
          ],
          [
            6,
            47
          ]
        ],
        "PositiveEvents": 53,
        "NegativeEvents": 26,
        "threshold": 0.5
      }
    },
    "XGBoost": {
      "validation": {
        "Accuracy": 0.6388888888888888,
        "BalancedAccuracy": 0.5681818181818181,
        "Precision": 0.65,
        "Recall": 0.8863636363636364,
        "Sensitivity": 0.8863636363636364,
        "Specificity": 0.25,
        "F1": 0.75,
        "ROC_AUC": 0.6793831168831168,
        "PR_AUC_average_precision": 0.7382547884280463,
        "BrierScore": 0.21812230348587036,
        "ConfusionMatrix": [
          [
            7,
            21
          ],
          [
            5,
            39
          ]
        ],
        "PositiveEvents": 44,
        "NegativeEvents": 28,
        "threshold": 0.5
      },
      "test": {
        "Accuracy": 0.6582278481012658,
        "BalancedAccuracy": 0.5395500725689405,
        "Precision": 0.6911764705882353,
        "Recall": 0.8867924528301887,
        "Sensitivity": 0.8867924528301887,
        "Specificity": 0.19230769230769232,
        "F1": 0.7768595041322314,
        "ROC_AUC": 0.5936139332365747,
        "PR_AUC_average_precision": 0.7494690839723619,
        "BrierScore": 0.2226133495569229,
        "ConfusionMatrix": [
          [
            5,
            21
          ],
          [
            6,
            47
          ]
        ],
        "PositiveEvents": 53,
        "NegativeEvents": 26,
        "threshold": 0.5
      }
    },
    "LightGBM": {
      "validation": {
        "Accuracy": 0.625,
        "BalancedAccuracy": 0.5568181818181819,
        "Precision": 0.6440677966101694,
        "Recall": 0.8636363636363636,
        "Sensitivity": 0.8636363636363636,
        "Specificity": 0.25,
        "F1": 0.7378640776699029,
        "ROC_AUC": 0.6712662337662337,
        "PR_AUC_average_precision": 0.7325669706732176,
        "BrierScore": 0.22210126064225932,
        "ConfusionMatrix": [
          [
            7,
            21
          ],
          [
            6,
            38
          ]
        ],
        "PositiveEvents": 44,
        "NegativeEvents": 28,
        "threshold": 0.5
      },
      "test": {
        "Accuracy": 0.6835443037974683,
        "BalancedAccuracy": 0.5780116110304789,
        "Precision": 0.7121212121212122,
        "Recall": 0.8867924528301887,
        "Sensitivity": 0.8867924528301887,
        "Specificity": 0.2692307692307692,
        "F1": 0.7899159663865546,
        "ROC_AUC": 0.634978229317852,
        "PR_AUC_average_precision": 0.7594197596439439,
        "BrierScore": 0.21373908377555295,
        "ConfusionMatrix": [
          [
            7,
            19
          ],
          [
            6,
            47
          ]
        ],
        "PositiveEvents": 53,
        "NegativeEvents": 26,
        "threshold": 0.5
      }
    },
    "TrainingPrevalence": {
      "validation": {
        "Accuracy": 0.6111111111111112,
        "BalancedAccuracy": 0.5,
        "Precision": 0.6111111111111112,
        "Recall": 1.0,
        "Sensitivity": 1.0,
        "Specificity": 0.0,
        "F1": 0.7586206896551724,
        "ROC_AUC": 0.5,
        "PR_AUC_average_precision": 0.6111111111111112,
        "BrierScore": 0.23765466297322252,
        "ConfusionMatrix": [
          [
            0,
            28
          ],
          [
            0,
            44
          ]
        ],
        "PositiveEvents": 44,
        "NegativeEvents": 28,
        "threshold": 0.5
      },
      "test": {
        "Accuracy": 0.6708860759493671,
        "BalancedAccuracy": 0.5,
        "Precision": 0.6708860759493671,
        "Recall": 1.0,
        "Sensitivity": 1.0,
        "Specificity": 0.0,
        "F1": 0.803030303030303,
        "ROC_AUC": 0.5,
        "PR_AUC_average_precision": 0.6708860759493671,
        "BrierScore": 0.22444124969318696,
        "ConfusionMatrix": [
          [
            0,
            26
          ],
          [
            0,
            53
          ]
        ],
        "PositiveEvents": 53,
        "NegativeEvents": 26,
        "threshold": 0.5
      }
    },
    "selected_by_validation_brier": "RandomForest",
    "definition": "Next Hb outside 10\u201312 g/dL (source notebook protocol)",
    "deployment_status": "NOT_SERVED: protocol approval and calibration/external validation absent; numerical regression only"
  }
}
```

Top SHAP associations: [{"feature": "hb", "mean_absolute_shap": 0.7504262924194336}, {"feature": "hb_max3", "mean_absolute_shap": 0.3533571660518646}, {"feature": "hb_slope_per_day", "mean_absolute_shap": 0.14931827783584595}, {"feature": "hb_mean3", "mean_absolute_shap": 0.13973571360111237}, {"feature": "hb_min3", "mean_absolute_shap": 0.040358979254961014}, {"feature": "potassium_post_slope_per_day", "mean_absolute_shap": 0.03960651159286499}, {"feature": "calcium_previous", "mean_absolute_shap": 0.03732308745384216}, {"feature": "calcium_slope_per_day", "mean_absolute_shap": 0.0315295085310936}, {"feature": "urr_slope_per_day", "mean_absolute_shap": 0.031465690582990646}, {"feature": "urr_min3", "mean_absolute_shap": 0.031078241765499115}]

Measured and predicted values are stored separately. SHAP explains the selected research candidate; when persistence is preferred the served explanation is a baseline rule, not SHAP evidence for an accepted ML output.

## URR

```json
{
  "Ridge": {
    "validation": {
      "MAE": 9.906067188159327,
      "RMSE": 13.41893498819211,
      "R2": 0.0010566494029895512,
      "MedianAbsoluteError": 7.571109841925093
    },
    "test": {
      "MAE": 11.308911802089272,
      "RMSE": 14.490521032419176,
      "R2": -0.024523209556874592,
      "MedianAbsoluteError": 8.34648491134034
    }
  },
  "RandomForest": {
    "validation": {
      "MAE": 9.403685255129293,
      "RMSE": 12.794006661479182,
      "R2": 0.09193296984487342,
      "MedianAbsoluteError": 6.753005779154357
    },
    "test": {
      "MAE": 10.572457778141183,
      "RMSE": 13.86049268979498,
      "R2": 0.06262981783248633,
      "MedianAbsoluteError": 8.147943784827916
    }
  },
  "XGBoost": {
    "validation": {
      "MAE": 9.349682884318835,
      "RMSE": 12.827711245749652,
      "R2": 0.08714223667310672,
      "MedianAbsoluteError": 7.305299674391456
    },
    "test": {
      "MAE": 11.002284689076493,
      "RMSE": 14.45779570803543,
      "R2": -0.019900878210420414,
      "MedianAbsoluteError": 9.362930297851562
    }
  },
  "LightGBM": {
    "validation": {
      "MAE": 9.610318887435303,
      "RMSE": 12.826812522665364,
      "R2": 0.08727014376262365,
      "MedianAbsoluteError": 7.725151221238313
    },
    "test": {
      "MAE": 11.684701932795274,
      "RMSE": 15.07979847444156,
      "R2": -0.1095448796435059,
      "MedianAbsoluteError": 11.441794419364939
    }
  },
  "baselines": {
    "Persistence": {
      "validation": {
        "MAE": 11.11137958038429,
        "RMSE": 16.005520332711736,
        "R2": -0.42116452323065956,
        "MedianAbsoluteError": 7.088979151689443
      },
      "test": {
        "MAE": 12.121504978386985,
        "RMSE": 16.96610848933726,
        "R2": -0.40448879164133444,
        "MedianAbsoluteError": 8.8601206248265
      }
    },
    "RollingMean3": {
      "validation": {
        "MAE": 11.628900094822585,
        "RMSE": 15.522324757792504,
        "R2": -0.3366518188763383,
        "MedianAbsoluteError": 8.806646359200219
      },
      "test": {
        "MAE": 10.528264318194697,
        "RMSE": 14.885339940062716,
        "R2": -0.08111355499158335,
        "MedianAbsoluteError": 6.764827091280878
      }
    },
    "TrainingMean": {
      "validation": {
        "MAE": 9.642280977092408,
        "RMSE": 13.61066023872777,
        "R2": -0.027692408579088612,
        "MedianAbsoluteError": 7.15824192286636
      },
      "test": {
        "MAE": 11.433571873184235,
        "RMSE": 14.356561951058412,
        "R2": -0.005668151989385972,
        "MedianAbsoluteError": 8.813552004808301
      }
    }
  },
  "group_kfold_train_only": {
    "Ridge": [
      {
        "MAE": 11.315225149189288,
        "RMSE": 15.14765750063316,
        "R2": -0.11248988489127076,
        "MedianAbsoluteError": 8.155316123981848
      },
      {
        "MAE": 10.199961237994238,
        "RMSE": 13.11846145797928,
        "R2": -0.051567765072937144,
        "MedianAbsoluteError": 8.19512565461745
      },
      {
        "MAE": 9.875989347813343,
        "RMSE": 13.922974397411325,
        "R2": -0.058943096581048016,
        "MedianAbsoluteError": 6.669904466965733
      }
    ],
    "RandomForest": [
      {
        "MAE": 10.666373573892884,
        "RMSE": 14.583336276026552,
        "R2": -0.03114299974900292,
        "MedianAbsoluteError": 6.070005338639646
      },
      {
        "MAE": 9.41151284013835,
        "RMSE": 12.638752518436787,
        "R2": 0.023932444124229124,
        "MedianAbsoluteError": 7.0049697167400495
      },
      {
        "MAE": 9.84340183102736,
        "RMSE": 13.414961663690274,
        "R2": 0.016923202046831953,
        "MedianAbsoluteError": 8.159450834835482
      }
    ],
    "XGBoost": [
      {
        "MAE": 10.975992437053243,
        "RMSE": 14.947914200845819,
        "R2": -0.08334381948804537,
        "MedianAbsoluteError": 6.876053915600593
      },
      {
        "MAE": 9.936523873467298,
        "RMSE": 12.735216041478193,
        "R2": 0.008976185239637613,
        "MedianAbsoluteError": 8.881474048232892
      },
      {
        "MAE": 10.40325346196874,
        "RMSE": 14.225385780841785,
        "R2": -0.10544383065544194,
        "MedianAbsoluteError": 8.286608886718767
      }
    ],
    "LightGBM": [
      {
        "MAE": 11.125103369138815,
        "RMSE": 15.216954769530401,
        "R2": -0.12269197079233307,
        "MedianAbsoluteError": 6.401802013610933
      },
      {
        "MAE": 9.852442214451862,
        "RMSE": 12.818269806997519,
        "R2": -0.003992051707402577,
        "MedianAbsoluteError": 8.479680244993926
      },
      {
        "MAE": 10.268359012009709,
        "RMSE": 14.432337438047142,
        "R2": -0.13784190269238916,
        "MedianAbsoluteError": 6.800593888433227
      }
    ]
  },
  "selected_candidate": "XGBoost",
  "served_method": "RESEARCH_MODEL",
  "served_test": {
    "MAE": 11.002284689076493,
    "RMSE": 14.45779570803543,
    "R2": -0.019900878210420414,
    "MedianAbsoluteError": 9.362930297851562
  },
  "selected_candidate_test_cluster_bootstrap": {
    "method": "Patient-cluster bootstrap, 500 resamples, exploratory small-cohort CI",
    "patients": 9,
    "MAE_95CI": [
      8.210893617116051,
      14.158732931252842
    ],
    "baseline_minus_model_MAE_95CI": [
      -1.966102616298798,
      3.606023203161745
    ]
  },
  "temporal": {
    "cutoff": "2024-09-01",
    "strategy": "Same-cohort temporal, training target dates <=cutoff; test feature dates >=cutoff, no future training outcomes",
    "train_rows": 232,
    "test_rows": 108,
    "patient_overlap_expected": true,
    "model": {
      "MAE": 9.034475699242705,
      "RMSE": 12.015368527376936,
      "R2": 0.057770581573941215,
      "MedianAbsoluteError": 6.058702700983282
    },
    "persistence": {
      "MAE": 10.440657258345352,
      "RMSE": 14.149003288913885,
      "R2": -0.3065744560029138,
      "MedianAbsoluteError": 6.743665868481415
    }
  },
  "exploratory_classification": {
    "LogisticRegression": {
      "validation": {
        "Accuracy": 0.7,
        "BalancedAccuracy": 0.5074786324786325,
        "Precision": 0.2857142857142857,
        "Recall": 0.1111111111111111,
        "Sensitivity": 0.1111111111111111,
        "Specificity": 0.9038461538461539,
        "F1": 0.16,
        "ROC_AUC": 0.5576923076923077,
        "PR_AUC_average_precision": 0.3293390969189009,
        "BrierScore": 0.21101984465456336,
        "ConfusionMatrix": [
          [
            47,
            5
          ],
          [
            16,
            2
          ]
        ],
        "PositiveEvents": 18,
        "NegativeEvents": 52,
        "threshold": 0.5
      },
      "test": {
        "Accuracy": 0.6835443037974683,
        "BalancedAccuracy": 0.5461956521739131,
        "Precision": 0.4166666666666667,
        "Recall": 0.21739130434782608,
        "Sensitivity": 0.21739130434782608,
        "Specificity": 0.875,
        "F1": 0.2857142857142857,
        "ROC_AUC": 0.6281055900621118,
        "PR_AUC_average_precision": 0.3989549518913201,
        "BrierScore": 0.21927571046582525,
        "ConfusionMatrix": [
          [
            49,
            7
          ],
          [
            18,
            5
          ]
        ],
        "PositiveEvents": 23,
        "NegativeEvents": 56,
        "threshold": 0.5
      }
    },
    "RandomForest": {
      "validation": {
        "Accuracy": 0.7285714285714285,
        "BalancedAccuracy": 0.5267094017094017,
        "Precision": 0.4,
        "Recall": 0.1111111111111111,
        "Sensitivity": 0.1111111111111111,
        "Specificity": 0.9423076923076923,
        "F1": 0.17391304347826086,
        "ROC_AUC": 0.767094017094017,
        "PR_AUC_average_precision": 0.47505529581414563,
        "BrierScore": 0.17214472167407988,
        "ConfusionMatrix": [
          [
            49,
            3
          ],
          [
            16,
            2
          ]
        ],
        "PositiveEvents": 18,
        "NegativeEvents": 52,
        "threshold": 0.5
      },
      "test": {
        "Accuracy": 0.7468354430379747,
        "BalancedAccuracy": 0.578027950310559,
        "Precision": 0.8,
        "Recall": 0.17391304347826086,
        "Sensitivity": 0.17391304347826086,
        "Specificity": 0.9821428571428571,
        "F1": 0.2857142857142857,
        "ROC_AUC": 0.6444099378881987,
        "PR_AUC_average_precision": 0.537078588244124,
        "BrierScore": 0.19201733923829736,
        "ConfusionMatrix": [
          [
            55,
            1
          ],
          [
            19,
            4
          ]
        ],
        "PositiveEvents": 23,
        "NegativeEvents": 56,
        "threshold": 0.5
      }
    },
    "XGBoost": {
      "validation": {
        "Accuracy": 0.7571428571428571,
        "BalancedAccuracy": 0.5822649572649572,
        "Precision": 0.5714285714285714,
        "Recall": 0.2222222222222222,
        "Sensitivity": 0.2222222222222222,
        "Specificity": 0.9423076923076923,
        "F1": 0.32,
        "ROC_AUC": 0.6773504273504274,
        "PR_AUC_average_precision": 0.5380331436899625,
        "BrierScore": 0.17018304765224457,
        "ConfusionMatrix": [
          [
            49,
            3
          ],
          [
            14,
            4
          ]
        ],
        "PositiveEvents": 18,
        "NegativeEvents": 52,
        "threshold": 0.5
      },
      "test": {
        "Accuracy": 0.7088607594936709,
        "BalancedAccuracy": 0.5128105590062112,
        "Precision": 0.5,
        "Recall": 0.043478260869565216,
        "Sensitivity": 0.043478260869565216,
        "Specificity": 0.9821428571428571,
        "F1": 0.08,
        "ROC_AUC": 0.5931677018633541,
        "PR_AUC_average_precision": 0.4278052041985957,
        "BrierScore": 0.20033705234527588,
        "ConfusionMatrix": [
          [
            55,
            1
          ],
          [
            22,
            1
          ]
        ],
        "PositiveEvents": 23,
        "NegativeEvents": 56,
        "threshold": 0.5
      }
    },
    "LightGBM": {
      "validation": {
        "Accuracy": 0.7571428571428571,
        "BalancedAccuracy": 0.5459401709401709,
        "Precision": 0.6666666666666666,
        "Recall": 0.1111111111111111,
        "Sensitivity": 0.1111111111111111,
        "Specificity": 0.9807692307692307,
        "F1": 0.19047619047619047,
        "ROC_AUC": 0.6431623931623932,
        "PR_AUC_average_precision": 0.48778585753818704,
        "BrierScore": 0.17697742950990358,
        "ConfusionMatrix": [
          [
            51,
            1
          ],
          [
            16,
            2
          ]
        ],
        "PositiveEvents": 18,
        "NegativeEvents": 52,
        "threshold": 0.5
      },
      "test": {
        "Accuracy": 0.7088607594936709,
        "BalancedAccuracy": 0.5,
        "Precision": 0.0,
        "Recall": 0.0,
        "Sensitivity": 0.0,
        "Specificity": 1.0,
        "F1": 0.0,
        "ROC_AUC": 0.6187888198757765,
        "PR_AUC_average_precision": 0.4652835787285181,
        "BrierScore": 0.19876855585559539,
        "ConfusionMatrix": [
          [
            56,
            0
          ],
          [
            23,
            0
          ]
        ],
        "PositiveEvents": 23,
        "NegativeEvents": 56,
        "threshold": 0.5
      }
    },
    "TrainingPrevalence": {
      "validation": {
        "Accuracy": 0.7428571428571429,
        "BalancedAccuracy": 0.5,
        "Precision": 0.0,
        "Recall": 0.0,
        "Sensitivity": 0.0,
        "Specificity": 1.0,
        "F1": 0.0,
        "ROC_AUC": 0.5,
        "PR_AUC_average_precision": 0.2571428571428571,
        "BrierScore": 0.19104191222828323,
        "ConfusionMatrix": [
          [
            52,
            0
          ],
          [
            18,
            0
          ]
        ],
        "PositiveEvents": 18,
        "NegativeEvents": 52,
        "threshold": 0.5
      },
      "test": {
        "Accuracy": 0.7088607594936709,
        "BalancedAccuracy": 0.5,
        "Precision": 0.0,
        "Recall": 0.0,
        "Sensitivity": 0.0,
        "Specificity": 1.0,
        "F1": 0.0,
        "ROC_AUC": 0.5,
        "PR_AUC_average_precision": 0.2911392405063291,
        "BrierScore": 0.2072391419983144,
        "ConfusionMatrix": [
          [
            56,
            0
          ],
          [
            23,
            0
          ]
        ],
        "PositiveEvents": 23,
        "NegativeEvents": 56,
        "threshold": 0.5
      }
    },
    "selected_by_validation_brier": "XGBoost",
    "definition": "Next URR <65% (source notebook protocol)",
    "deployment_status": "NOT_SERVED: protocol approval and calibration/external validation absent; numerical regression only"
  }
}
```

Top SHAP associations: [{"feature": "urr", "mean_absolute_shap": 2.733167886734009}, {"feature": "sodium_slope_per_day", "mean_absolute_shap": 1.1867907047271729}, {"feature": "creatinine_post_max3", "mean_absolute_shap": 0.7196036577224731}, {"feature": "albumin_mean3", "mean_absolute_shap": 0.6610847115516663}, {"feature": "urr_sd3", "mean_absolute_shap": 0.5873645544052124}, {"feature": "urr_min3", "mean_absolute_shap": 0.5832746028900146}, {"feature": "albumin_min3", "mean_absolute_shap": 0.5082825422286987}, {"feature": "creatinine_pre_previous", "mean_absolute_shap": 0.44405895471572876}, {"feature": "calcium_slope_per_day", "mean_absolute_shap": 0.39800944924354553}, {"feature": "potassium_pre_slope_per_day", "mean_absolute_shap": 0.3951064944267273}]

Measured and predicted values are stored separately. SHAP explains the selected research candidate; when persistence is preferred the served explanation is a baseline rule, not SHAP evidence for an accepted ML output.

## Dry weight

{
  "status": "INSUFFICIENT_DATA_FOR_RELIABLE_MODEL",
  "rows": 763,
  "unique_patients": null,
  "missing_required_fields": [
    "patient_id",
    "date",
    "current_dry_weight"
  ],
  "legacy_prediction_export_descriptive_metrics": {
    "MAE": 0.42283879423328985,
    "RMSE": 0.9755719980913896,
    "R2": 0.9951357370924607,
    "MedianAbsoluteError": 0.1700000000000017
  },
  "post_hd_weight_proxy_descriptive_metrics": {
    "MAE": 0.4470511140235911,
    "RMSE": 0.9293876843868268,
    "R2": 0.9955853913091541,
    "MedianAbsoluteError": 0.20000000000000284
  },
  "interpretation": "Exported errors are descriptive, not a freshly grouped validation. Post-HD weight is a proxy, NOT next-dry-weight persistence. True persistence/rolling/LOCF cannot be reconstructed; legacy model not promoted."
}

## IDH

INSUFFICIENT_DATA_FOR_RELIABLE_MODEL. Original session/event data missing; SYS-derived target leakage in MLP notebooks and row-level random splitting invalidate reuse of reported legacy accuracy.

## Limitations and deployment

Dataset permission: UNVERIFIED. Clinical validation: NOT_COMPLETED. Source precleaning provenance: UNVERIFIED. Internal patient-disjoint evaluation cannot undo interpolation already present in the supplied source.
Single-cohort and small patient test sets, no hospital external validation, no randomized or prospective impact evaluation. Test metrics and bootstrap CIs are exploratory, not a claim of population/clinical benefit.
Exploratory classifiers use source notebook labels (Hb outside 10–12, URR <65). They are fitted and plotted but not served as clinical risk probabilities; protocol approval and independent calibration are absent.
Temporal validation is a distinct same-cohort experiment: targets through 2024-09-01 train, origins from 2024-09-01 test. It is not a new patient/hospital test.
Artifacts contain the full imputation/scaling/model pipeline, ordered feature contract, source/artifact hashes, package versions, thresholds, selection reason and exact partition counts. No source-supplied pickle is executed.
Operational integration serves numeric forecasts through authenticated Django → Spring clinical authorization → patient EHR UI; snapshots/reviews/FHIR/provenance are auditable. Research source rows are not imported as real EHR patient observations.

## Reproduction

`python run_training.py --source /path/to/extracted/e19-repository --key-file /private/pseudonym.key`
Reuse the same private HMAC key and locked package versions for the same split manifest. The key and original subject IDs are deliberately not packaged.
