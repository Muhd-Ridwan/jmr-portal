# jmr-portal

Run backend uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

Making a system to manage kids that take tuition service and reading quran service.

Frontend:- React Javascript
Backend :- FastAPI

2 Types of Service: 1. Reading Quran 2. Tuition + Reading Quran

Fees:- 1. RM 30/month/person 2. RM 200/month/person

Registration Fees (1 Time):- 1. RM 20/person 2. RM 50/person

1 Parents can have multiple children that take the service.
The kids always can be lookup based on their parents name.
Perhaps PK = Parents name / email(if applicable)

Tech Stack:- 1. NoSQL Database to store profile 2. Object Database to save resit (if any)

Flow:- 1. Login (Currently only admin (which is my parents)) 2. Admin profile such as (name, email, address, phone_num, pass(in hash)) 3. Have forgot password function that will send link to reset password to email.

Customer Profile:-
parent_name, email, phone_num (can be many, so can add another number function), address
Then under parents have childs name with DOB(DOB is optional)
Customer for now, can't login, but will enhance further later.
