# Seven-family benchmark results

Internal retrospective research only. Historical test patients reused. No automatic deployment.

| Task | Algorithm | Trained | Evaluated | Validation metric | Test metric | Gate passed | Served |
|---|---|---|---|---:|---:|---|---|
| hb | regularized_linear | TRAINED_RESEARCH_ONLY | True | 1.1282747747617572 | 0.9450125082156158 | False | no |
| hb | random_forest | TRAINED_RESEARCH_ONLY | True | 1.0608203013534632 | 0.9123320209025719 | False | no |
| hb | extra_trees | TRAINED_RESEARCH_ONLY | True | 1.0137835680269645 | 0.9351038468049774 | False | no |
| hb | hist_gradient_boosting | TRAINED_RESEARCH_ONLY | True | 1.0814823549588573 | 0.915998480897616 | False | no |
| hb | xgboost | TRAINED_RESEARCH_ONLY | True | 1.0470571147070988 | 0.9391143605678892 | False | no |
| hb | support_vector | TRAINED_RESEARCH_ONLY | True | 1.304449933798401 | 1.1805008100093688 | False | no |
| hb | nearest_neighbors | TRAINED_RESEARCH_ONLY | True | 1.3462413672718858 | 1.349998417204182 | False | no |
| hb | persistence (baseline) | no fit | yes | 0.9791666666666666 | 0.8708860759493672 | selected: True | see deployed registry |
| hb | training_mean (baseline) | no fit | yes | 1.6320029239766076 | 1.6871419053964023 | selected: False | see deployed registry |
| hb | training_median (baseline) | no fit | yes | 1.6041666666666665 | 1.6759493670886076 | selected: False | see deployed registry |
| urr | regularized_linear | TRAINED_RESEARCH_ONLY | True | 9.906067188159323 | 11.308911802561786 | False | no |
| urr | random_forest | TRAINED_RESEARCH_ONLY | True | 9.632784081410371 | 10.475786431659394 | False | no |
| urr | extra_trees | TRAINED_RESEARCH_ONLY | True | 9.27907952335203 | 10.774305642936076 | True | no |
| urr | hist_gradient_boosting | TRAINED_RESEARCH_ONLY | True | 9.657344143520849 | 11.316597131502961 | False | no |
| urr | xgboost | TRAINED_RESEARCH_ONLY | True | 9.213276849672102 | 11.09564902948674 | True | no |
| urr | support_vector | TRAINED_RESEARCH_ONLY | True | 9.321484998192679 | 10.73435261100863 | True | no |
| urr | nearest_neighbors | TRAINED_RESEARCH_ONLY | True | 9.702792737565073 | 11.492753635578618 | False | no |
| urr | persistence (baseline) | no fit | yes | 11.11137958038429 | 12.121504978386985 | selected: False | see deployed registry |
| urr | training_mean (baseline) | no fit | yes | 9.642280977092408 | 11.433571873184235 | selected: False | see deployed registry |
| urr | training_median (baseline) | no fit | yes | 9.480302546254837 | 11.07475227742825 | selected: False | see deployed registry |
| hyperkalemia | regularized_linear | TRAINED_RESEARCH_ONLY | True | 0.18192723992799276 | 0.15351733236196172 | True | no |
| hyperkalemia | random_forest | TRAINED_RESEARCH_ONLY | True | 0.17725153296583362 | 0.16177804424328732 | True | no |
| hyperkalemia | extra_trees | TRAINED_RESEARCH_ONLY | True | 0.1841557703712301 | 0.14948175825167104 | True | no |
| hyperkalemia | hist_gradient_boosting | TRAINED_RESEARCH_ONLY | True | 0.22128874572130985 | 0.14072956758959157 | False | no |
| hyperkalemia | xgboost | TRAINED_RESEARCH_ONLY | True | 0.20211704075336456 | 0.14492976665496826 | True | no |
| hyperkalemia | support_vector | TRAINED_RESEARCH_ONLY | True | 0.21111163337068029 | 0.13390466781323196 | False | no |
| hyperkalemia | nearest_neighbors | TRAINED_RESEARCH_ONLY | True | 0.20443681851011858 | 0.15715335859220508 | True | no |
| hyperkalemia | training_prevalence (baseline) | no fit | yes | 0.2216435185185185 | 0.13201037271448668 | selected: False | see deployed registry |
| hyperkalemia | majority_class (baseline) | no fit | yes | 0.3055555555555556 | 0.1518987341772152 | selected: False | see deployed registry |
