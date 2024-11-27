var MarksDevCommandButtons = {

    cloneRecordsClick: function (selRefs) {
                duplicateRecords(selRefs);
    },
    __namespace: true
};

// Function to remove non-copyable properties and format custom lookup references properly 

async function filterAndPrepareProperties(obj) {
    const processedRecord = { ...obj }; // Clone the object to avoid modifying the original
    const customPrefix = "mln"; //modify this to the custom prefix of the lookup columns you want to preserve.  If you have multiple you will need to modify the condition below to handle this.  e.g. if ((key.startsWith(`_${customPrefix1}_`) || key.startsWith(`_${customPrefix2}_`)) 
    for (const key in processedRecord) {
        if (key.startsWith(`_${customPrefix}_`) && !key.includes('@')) {
            
            // Handle lookup columns with the a prefix
            const logicalName = obj[`${key}@Microsoft.Dynamics.CRM.lookuplogicalname`]; //get the name of the related table from the original backup copy of the object
            const logicalLookup = obj[`${key}@Microsoft.Dynamics.CRM.associatednavigationproperty`]; //get the proper name of the lookup column (with any capitalizations)
            const id = obj[key]; //get the id of the related record in the original copy's lookup

            if (logicalName && id) {
                try {
                    //get metadata of the related table using Xrm.Utility.getEntityMetadata
                    const metadata = await Xrm.Utility.getEntityMetadata(logicalName);
                    const collectionName = metadata.EntitySetName; // Get the logical collection name (plural name) of the related table

                    //Construct the @odata.bind property name and value
                    const propertyName = logicalLookup + "@odata.bind";
                    processedRecord[propertyName] = `/${collectionName}(${id})`;

                } catch (error) {
                    console.error(`Error retrieving metadata for ${logicalName}:`, error.message);
                }
            }

            // Remove the original lookup property
            delete processedRecord[key];
        } 
        else if (key.startsWith("_") ) {
            // Remove other non-copyable properties
            delete processedRecord[key];
        }
        
    }
    return processedRecord;
}

// Clone records function
async function duplicateRecords(selRecs) {

    //alert if no selected records--irrelevant if you set your command button to only show if CountRows(Self.Selected.AllItems)>0
    if (!selRecs || selRecs.length === 0) {
        Xrm.Navigation.openAlertDialog({ text: `No records selected.` });
        return;
    }

    const tableName = selRecs[0].TypeName; // Logical name of the table
    const metadata = await Xrm.Utility.getEntityMetadata(tableName);  //get metadata for table
    const tablePrimaryNameColumn = metadata.PrimaryNameAttribute; // get the name of the primary name column for the record
    const tablePrimaryIdColumn = metadata.primaryIdAttribute; // get the name of the primary id column for the record

    const createPromises = []; //promises array to make sure the final refresh of the list waits until all records are copied

    for (const record of selRecs) {
        try {
            const recordPromise = Xrm.WebApi.retrieveRecord(tableName, record.Id)
                .then(async function (result) {
 
                    // Process record to remove non-cloneable properties and prepare lookups
                    const recordNew = await filterAndPrepareProperties(result);

                    // Remove the primary key column
                    delete recordNew[tablePrimaryIdColumn];//_primaryIdAttribute

                    // Add " (copy)" to the primary name property
                    if (recordNew[tablePrimaryNameColumn]) {
                        recordNew[tablePrimaryNameColumn] += " (copy)";
                    }

                    // Create the new record
                    return Xrm.WebApi.createRecord(tableName, recordNew)
                        .then(function (result) {
                        })
                        .catch(function (error) {
                            Xrm.Navigation.openAlertDialog({ text: `Error creating record: ${error.message}` });
                            console.error(`Xrm.WebApi Error: ${error.message}`);
                        });
                })
                .catch(function (error) {
                    console.error("Error retrieving record:", error.message);
                });

            createPromises.push(recordPromise);
        } catch (error) {
            console.error("Error duplicating record: ", error);
            Xrm.Navigation.openAlertDialog({ text: `Error duplicating record with ID: ${record.Id}` });
        }
    }

    await Promise.all(createPromises);

    Xrm.Navigation.openAlertDialog({ text: `${selRecs.length} Record(s) duplicated successfully!` });

  //Force App to Navigate to the listview of the current table (refresh the list to see new copies)
    const pageInput = { pageType: "entitylist", entityName: tableName };
   
    Xrm.Navigation.navigateTo(pageInput).then(
        function success() {
            // Run code on success
        },
        function error() {
            // Handle errors
        }
    );
}
