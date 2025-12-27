#!/bin/bash

# This script fixes all services to use lazy Firebase initialization

echo "Fixing Department Service..."
sed -i '' 's/this\.db = getFirestore();/this.db = null;/' src/services/department.service.js
sed -i '' '11a\
\
  getDb() {\
    if (!this.db) {\
      this.db = getFirestore();\
    }\
    return this.db;\
  }
' src/services/department.service.js
sed -i '' 's/this\.db\./this.getDb()./g' src/services/department.service.js

echo "Fixing Employee Service..."
sed -i '' 's/this\.db = getFirestore();/this.db = null;/' src/services/employee.service.js
sed -i '' '11a\
\
  getDb() {\
    if (!this.db) {\
      this.db = getFirestore();\
    }\
    return this.db;\
  }
' src/services/employee.service.js  
sed -i '' 's/this\.db\./this.getDb()./g' src/services/employee.service.js

echo "Fixing Shift Service..."
sed -i '' 's/this\.db = getFirestore();/this.db = null;/' src/services/shift.service.js
sed -i '' '9a\
\
  getDb() {\
    if (!this.db) {\
      this.db = getFirestore();\
    }\
    return this.db;\
  }
' src/services/shift.service.js
sed -i '' 's/this\.db\./this.getDb()./g' src/services/shift.service.js

echo "Fixing Attendance Service..."
sed -i '' 's/this\.db = getFirestore();/this.db = null;/' src/services/attendance.service.js
sed -i '' '10a\
\
  getDb() {\
    if (!this.db) {\
      this.db = getFirestore();\
    }\
    return this.db;\
  }
' src/services/attendance.service.js
sed -i '' 's/this\.db\./this.getDb()./g' src/services/attendance.service.js

echo "Done! All services fixed."
